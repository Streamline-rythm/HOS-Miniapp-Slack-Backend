// 📦 Imports
import http from 'http';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import express from 'express';
import { Server } from 'socket.io';
import crypto from 'crypto';

import pool from './db.js';
import { NONAME } from 'dns';

dotenv.config();

// 🚀 App Setup
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 20000,
  pingInterval: 10000
});

const onlineUsers = new Map();
const EXTERNAL_WEBHOOK_URL = 'https://hook.us2.make.com/dofk0pewchek787h49faugkr5ql7otnu';
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const TARGET_CHANNEL = 'C097MNT5HM5';
const SLACK_REPLIES_API_URL = 'https://slack.com/api/conversations.replies';

app.use(cors());

// ✅ JSON parser with raw body capture for Slack signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// 📦 Utilities
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const getRepliesForMessages = async (messageIds) => {
  if (messageIds.length === 0) return {};
  const [rows] = await pool.query(
    'SELECT * FROM replies WHERE message_id IN (?) ORDER BY reply_at ASC',
    [messageIds]
  );
  const repliesByMessage = {};
  rows.forEach(reply => {
    if (!repliesByMessage[reply.message_id]) repliesByMessage[reply.message_id] = [];
    repliesByMessage[reply.message_id].push(reply);
  });
  return repliesByMessage;
};

// ✅ Webhook to receive replies externally
app.post('/webhook/reply', asyncHandler(async (req, res) => {
  const { messageId, reply } = req.body;
  if (!messageId || typeof reply !== 'string') return res.status(400).json({ error: 'Invalid payload' });

  const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await pool.query('INSERT INTO replies (message_id, reply_content, reply_at) VALUES (?, ?, ?)', [messageId, reply, currentTime]);

  const [[msg]] = await pool.query('SELECT user_id FROM messages WHERE id = ?', [messageId]);
  if (msg) {
    const userId = msg.user_id;
    const socketId = onlineUsers.get(userId);
    if (socketId) io.to(socketId).emit('reply', { messageId, reply, currentTime });
  }
  res.json({ status: 'ok' });
}));

// ✅ Fetch user messages
app.get('/messages', asyncHandler(async (req, res) => {
  const userId = req.query.userId;
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const [messages] = await pool.query(
    'SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [userId, limit, offset]
  );

  const sortedMessages = messages.reverse();
  const messageIds = sortedMessages.map(m => m.id);
  const repliesByMessage = await getRepliesForMessages(messageIds);
  const messagesWithReplies = sortedMessages.map(msg => ({
    ...msg,
    replies: repliesByMessage[msg.id] || []
  }));

  res.json(messagesWithReplies);
}));

// ✅ Telegram user verification
app.post('/verify', asyncHandler(async (req, res) => {
  const { telegramId } = req.body;
  const [rows] = await pool.query('SELECT * FROM driversDirectory WHERE telegramId = ?', [`@${telegramId}`]);
  if (rows.length === 0) return res.status(403).json({ error: 'Access denied: Not a member.' });
  return res.status(200).json({ ok: true });
}));

// ✅ Slack Verification Helpers
function verifySlackRequest(req) {
  const timestamp = req.headers['x-slack-request-timestamp'];
  const slackSignature = req.headers['x-slack-signature'];
  if (!timestamp || !slackSignature) return false;

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp) < fiveMinutesAgo) return false;

  const sigBaseString = `v0:${timestamp}:${req.rawBody.toString()}`;
  const hmac = crypto.createHmac('sha256', SLACK_SIGNING_SECRET);
  const digest = 'v0=' + hmac.update(sigBaseString).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(slackSignature));
  } catch (e) {
    return false;
  }
}

async function getParentMessage(thread_ts) {
  try {
    const res = await axios.get(SLACK_REPLIES_API_URL, {
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
      params: { channel: TARGET_CHANNEL, ts: thread_ts, limit: 1 }
    });
    const messages = res.data.messages || [];
    if (!messages.length) return null;
    const parentText = messages[0].text;
    const match = parentText.match(/\(TGID \[([^\]]+)\]/);
    const tgId = match ? match[1] : null;
    const parentCoreText = parentText.split('[').pop().replace(/[`[\]]/g, '').trim();
    return {
      "parentCoreText" : parentCoreText,
      "tgId": tgId
    };
  } catch (err) {
    console.error('Slack API error:', err.message);
    return null;
  }
}

async function getParentMessageId(content) {
  const parentCoreText = content.parentCoreText;
  const tgId =content.tgId;
  try {
    const [rows] = await pool.query( 'SELECT MAX(id) AS max_id FROM messages WHERE content = ? AND user_id = ?', [parentCoreText, tgId]);
    return rows[0]?.max_id || null;
  } catch (err) {
    console.error('DB lookup error:', err.message);
    return null;
  }
}

async function saveSlackReply(messageId, content) {
  try {
    const replyAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.query('INSERT INTO replies (message_id, reply_content, reply_at) VALUES (?, ?, ?)', [messageId, content, replyAt]);
    return { messageId, content, replyAt };
  } catch (err) {
    console.error('DB insert error:', err.message);
    return null;
  }
}

async function sendingSlackReplyToFrontend(prop) {
  const messageId = prop["messageId"];
  const reply = prop["content"];
  const currentTime = prop["replyAt"];

  const [[msg]] = await pool.query('SELECT user_id FROM messages WHERE id = ?', [messageId]);
  if (msg) {
    const userId = msg.user_id;
    console.log("sending slack user ID=", userId);
    const socketId = onlineUsers.get(userId);
    console.log("sending slack socket ID=", socketId);
    if (socketId) io.to(socketId).emit('reply', { messageId, reply, currentTime });
    return true
  }

  return false
}

// ✅ Slack Event Listener
app.post('/slack/events', async (req, res) => {
  if (!verifySlackRequest(req)) return res.status(403).send({ error: 'Invalid Slack signature' });

  const payload = req.body;
  // console.log("request body:", payload);

  if (payload.type === 'url_verification') return res.send({ challenge: payload.challenge });
  if (payload.type !== 'event_callback') return res.send({ status: 'ignored' });

  const event = payload.event;

  if (
    event.type === 'message' &&
    !event.subtype &&
    event.channel === TARGET_CHANNEL &&
    event.thread_ts &&
    event.ts !== event.thread_ts
  ) {
    try {
      const parentMsg = await getParentMessage(event.thread_ts);
      if (!parentMsg) return res.send({ status: 'error', reason: '❌ Parent message not found' });

      const parentId = await getParentMessageId(parentMsg);
      if (!parentId) return res.send({ status: 'error', reason: '❌ Message ID not found' });

      const result = await saveSlackReply(parentId, event.text);
      if (!result) return res.send({ status: 'error', reason: '❌ DB save failed' });

      // console.log('✅ Slack reply saved:', result);

      const sendingResult = await sendingSlackReplyToFrontend(result);
      if (!sendingResult) return res.send({ status: 'error', reason: '❌ Reply sending failed' });

      console.log("✅ Success slack reply sending")

    } catch (err) {
      console.error('Slack handler error:', err.message);
    }
  }

  return res.send({ status: 'ok' });
});

// ✅ Socket.IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('socket register', (msg) => {
    if (msg.userId) onlineUsers.set(msg.userId, socket.id);
  });

  socket.on('chat message', async (msg, callback) => {
    if (!msg.userId || typeof msg.content !== 'string') return;

    try {
      const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const [result] = await pool.query(
        'INSERT INTO messages (user_id, content, created_at) VALUES (?, ?, ?)',
        [msg.userId, msg.content, currentTime]
      );

      await axios.post(EXTERNAL_WEBHOOK_URL, {
        messageId: result.insertId,
        userId: msg.userId,
        content: msg.content,
        destination: msg.destination
      });

      callback({ success: true, request: msg.content, timestamp: currentTime });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  });

  socket.on('disconnect', () => {
    for (const [userId, sockId] of onlineUsers.entries()) {
      if (sockId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

// ✅ Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
