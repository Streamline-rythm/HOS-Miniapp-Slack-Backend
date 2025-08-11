<h1 align="center">🚚 HOS Telegram MiniApp Backend 💬</h1>

<p align="center">
  <b>Instant Driver–Support Communication, Right Inside Telegram</b>  
  <br>
  Built with ❤️ using <strong>Express</strong> + <strong>Cloud SQL</strong> + <strong>Make.com</strong>
</p>

---

## ✨ About the Project
The **HOS Telegram MiniApp** is a lightweight yet powerful web application that allows **drivers** to instantly connect with the **support team** through Telegram.  
Whether it’s reporting an issue or getting real-time assistance — this app makes it fast, simple, and seamless.

---

## 🎯 Key Features
- 📩 **Direct Chat Support** — Drivers can send and receive help instantly.
- ⚡ **Fast & Responsive** — Optimized for Telegram MiniApp performance.
- 🔄 **Live Development Reloading** — Instant preview while coding.
- ☁️ **Cloud SQL Integration** — Reliable backend database for storing data.

---

## 🛠 Tech Stack
| Layer         | Technology |
|--------------|------------|
| **Backend** | Express |
| **Database** | Cloud SQL |
| **integration** | Make.com |
| **Platform** | Telegram MiniApp |
| **Package Manager** | npm |

---

## 🚀 Getting Started

### 1️⃣ Clone the Repository
```sh
git clone https://github.com/Sy4fiqNoor/HOS-Telegram-Miniapp-Slack-Backend.git
```

### 2️⃣ Navigate to the Project
```sh
cd HOS-Telegram-MiniApp-Slack-backend
```

### 3️⃣ Install Dependencies
```sh
npm i
```

### 4️⃣ Start the Development Server
```sh
npm run dev
```
> 💡 The app will launch with **auto-reload** and **instant preview** for rapid development.

---

## 📜 Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot-reloading |
| `npm run build` | Build the project for production |
| `npm run preview` | Preview the production build locally |

---

## 📜 Database table query
```sh
CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id TEXT,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  reply_content TEXT,
  reply_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
```

---

## 📷 Screenshots
> *(Add screenshots or GIFs of your MiniApp here for a better visual preview)*  

---

## 🤝 Contributing
Contributions are welcome! 🎉  
If you have ideas for improvement or new features:
1. Fork the repository
2. Create your branch (`git checkout -b feature/awesome-feature`)
3. Commit your changes (`git commit -m 'Add awesome feature'`)
4. Push to your branch (`git push origin feature/awesome-feature`)
5. Create a Pull Request 🚀

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).

---

<p align="center">Made with ❤️ by the <strong>HOS Development Team</strong></p>
