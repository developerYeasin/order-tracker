# Custom T-Shirt Order Tracker

A professional web-based Order Management System (OMS) for custom t-shirt businesses. Track the entire lifecycle of orders from initial request to final delivery.

## 🚀 Features

### Order Management
- **Complete Order Information**: Customer name, phone, location (Division, District, Upazila/Zone)
- **Product Details**: Description, payment method (COD/Prepaid)
- **Media Attachments**: Upload design images and reference videos
- **Courier Tracking**: Assign and track parcel IDs

### Production & Logistics Stages
- **Design**: Pending → Ready/Approved
- **Production**: To be Printed → Printed
- **Picking**: Picking Done
- **Delivery**: Submitted to Courier → Delivered OR Returned

### Dashboard & Analytics
- **Real-time Stats**: Total orders, pending designs, ready to print, out for delivery
- **Delivery Performance**: Success rate percentage
- **Regional Insights**: Breakdown by Division and District
- **Order Trends**: 30-day order history chart

### Search & Filter
- Search by customer name, phone number, or courier parcel ID
- Filter by location (Division/District)
- Filter by production stage

### User Experience
- Mobile responsive design
- Dark mode UI (high contrast)
- Password-protected admin login
- Quick-action buttons for status updates
- Real-time progress tracking

## 🛠️ Tech Stack

**Backend:**
- Python 3.11
- Flask REST API
- MySQL Database (SQLAlchemy ORM)
- bcrypt for password hashing

**Frontend:**
- React 18 (SPA)
- React Router for navigation
- Axios for API calls
- Tailwind CSS for styling

**Infrastructure:**
- Docker & Docker Compose
- Nginx (production reverse proxy)
- Systemd service (non-Docker deployment)

## 📦 Quick Start with Docker

### Prerequisites
- Docker & Docker Compose installed
- Git

### Installation

1. **Clone or Extract the Project**
   ```bash
   cd order-tracker
   ```

2. **Set Environment Variables**
   ```bash
   cp .env.template .env
   ```

   Edit `.env` and configure your database credentials:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   The application will automatically create an initial admin user on first startup:
   - Email: `admin@example.com`
   - Password: `admin123`

3. **Start Services**
   ```bash
   docker-compose up -d
   ```

4. **Access the Application**
   - Frontend: http://localhost
   - API: http://localhost:8090/api

5. **Login**
   - Email: `admin@example.com`
   - Password: `admin123`
   (If you've created other users, use their credentials.)

## 🔧 Manual Setup (Without Docker)

### Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup MySQL database
mysql -u root -p <<EOF
CREATE DATABASE order_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'order_user'@'localhost' IDENTIFIED BY 'order_pass_123!';
GRANT ALL PRIVILEGES ON order_tracker.* TO 'order_user'@'localhost';
FLUSH PRIVILEGES;
EOF

# Create .env file
cp .env.template .env
# Edit .env and configure your database connection (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)

# Initialize database (creates tables and default admin user)
python init_db.py

# Run backend
python app.py
```

Backend will start on http://localhost:8090

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Or build for production
npm run build
```

## 📁 Project Structure

```
order-tracker/
├── backend/
│   ├── app.py              # Flask application factory
│   ├── config.py           # Configuration
│   ├── models.py           # SQLAlchemy models
│   ├── init_db.py          # Database initialization
│   ├── requirements.txt    # Python dependencies
│   ├── routes/
│   │   ├── auth.py         # Authentication endpoints
│   │   ├── orders.py       # Order CRUD operations
│   │   ├── media.py        # File upload/download
│   │   ├── analytics.py    # Dashboard statistics
│   │   └── activity.py     # Activity logs
│   └── uploads/            # Uploaded files (auto-created)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx
│   │   │   ├── Layout.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Orders.jsx
│   │   │   └── Analytics.jsx
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx
│   │   └── services/
│   │       └── api.js
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml
└── README.md
```

## 🗄️ Database Schema

### orders
- `id` - Primary key
- `customer_name` - Customer full name
- `phone_number` - Contact number
- `division`, `district`, `upazila_zone` - Location
- `description` - Order details
- `payment_type` - COD or Prepaid
- `courier_parcel_id` - Tracking number
- `created_at`, `updated_at` - Timestamps

### order_status
- `order_id` - Foreign key to orders
- `design_ready` - Boolean flag
- `is_printed` - Boolean flag
- `picking_done` - Boolean flag
- `delivery_status` - Submitted/Delivered/Returned

### media
- `order_id` - Foreign key
- `file_path` - Path to stored file
- `file_type` - Image or Video

### activity_log
- `order_id` - Foreign key
- `action` - Action performed
- `details` - Additional info
- `timestamp` - When action occurred

## 🔐 Authentication

- Simple token-based authentication
- Admin password stored as bcrypt hash in `.env`
- Default password: `admin123` (change immediately!)

## ⚙️ Configuration

### Backend (.env)
```bash
SECRET_KEY=your-secret-key
DB_HOST=localhost
DB_PORT=3306
DB_USER=order_user
DB_PASSWORD=order_pass_123!
DB_NAME=order_tracker
PORT=8090
DEBUG=False
UPLOAD_FOLDER=uploads
ADMIN_PASSWORD_HASH=<bcrypt-hash>
```

### Frontend (vite.config.js)
```
Proxy to backend: /api → http://localhost:8090
Development port: 3000
```

## 🚀 Production Deployment

### Using Systemd

1. **Build and run backend standalone**
   ```bash
   cd backend
   ./install.sh
   ```

2. **Copy service file**
   ```bash
   sudo cp order-tracker.service /etc/systemd/system/
   sudo systemctl enable --now order-tracker
   ```

3. **Build frontend**
   ```bash
   cd frontend
   npm run build
   ```

4. **Deploy to web server**
   Copy `dist/` to your web server root (e.g., `/var/www/html`)

### Using Nginx

Configure nginx to serve static files and proxy API:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🧪 Testing

### API Endpoints

**Authentication:**
- `POST /api/login` - Login with password
- `GET /api/verify` - Verify token
- `POST /api/logout` - Logout

**Orders:**
- `GET /api/orders` - List all (with filters)
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id` - Update order
- `PUT /api/orders/:id/status` - Update status only
- `DELETE /api/orders/:id` - Delete order

**Media:**
- `GET /api/orders/:id/media` - List files
- `POST /api/orders/:id/media` - Upload files
- `DELETE /api/media/:id` - Delete file

**Analytics:**
- `GET /api/analytics/dashboard` - Dashboard stats
- `GET /api/analytics/regions` - Regional breakdown
- `GET /api/analytics/trends` - Order trends

## 📝 Default Credentials

- **Admin Login**: Email `admin@example.com`, Password `admin123`
- **MySQL Root**: `rootpassword`
- **MySQL User**: `order_user`
- **MySQL Password**: `order_pass_123!`

⚠️ **Change all default passwords immediately after installation!**

## 🔍 Troubleshooting

### "Not Found" error on login
Check that the backend is running on port 8090 and the API proxy is configured correctly.

### Database connection failed
Ensure MySQL is running and credentials in `.env` are correct.

### File uploads not working
Verify that the `uploads/` directory exists and has write permissions.

### Docker containers won't start
Check logs: `docker-compose logs <service-name>`

## 📄 License

MIT License - Use freely for your business
