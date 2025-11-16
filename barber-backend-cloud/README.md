# 💈 Barber Backend Cloud - README

## 🚀 Quick Start

### Local Development

```bash
npm install
npm start
```

Backend runs on `http://localhost:3000`

### Deploy to Railway

1. Push to GitHub
2. Connect repo to Railway
3. Railway auto-deploys
4. Get your URL from Railway dashboard

## 📡 API Endpoints

### Public Endpoints
- `GET /api/test` - Health check
- `GET /api/barbieri` - List barbers
- `GET /api/servizi` - List services
- `GET /api/disponibilita/:barbiereId/:data` - Available slots
- `POST /api/prenotazioni` - Create booking
- `GET /api/prenotazioni/:data` - Bookings by date
- `DELETE /api/prenotazioni/:id` - Cancel booking

### SMSGate Polling Endpoints
- `GET /api/smsgate/pending` - Get pending SMS (polled by SMSGate)
- `POST /api/smsgate/sent` - Mark SMS as sent
- `POST /api/smsgate/error` - Report SMS error

### Admin Endpoints
- `GET /api/admin/prenotazioni` - All bookings
- `GET /api/admin/sms` - SMS history
- `GET /api/sms/stats` - SMS statistics

## 🔧 Environment Variables

Create `.env` file:

```
PORT=3000
NODE_ENV=production
```

## 📱 SMSGate Integration

SMSGate polls `/api/smsgate/pending` every 10 seconds to get new SMS to send.

Configure SMSGate webhook:
- URL: `https://your-backend-url.railway.app/api/smsgate/pending`
- Method: GET
- Interval: 10 seconds

## 🗄️ Database

Uses SQLite for simplicity. In production, consider PostgreSQL for better reliability.

## 📊 How It Works

1. Client books via web app
2. Backend saves booking + adds SMS to queue
3. SMSGate polls `/api/smsgate/pending` every 10s
4. SMSGate sends SMS
5. SMSGate notifies backend via `/api/smsgate/sent`
6. Client receives SMS confirmation ✅

## 🎯 Next Steps

1. Deploy to Railway
2. Install SMSGate on Android
3. Configure SMSGate polling
4. Test with sample booking
5. Build web app frontend

---

**Made with ❤️ for barber shops**
