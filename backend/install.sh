#!/bin/bash

# Order Tracker Installation Script

echo "🚀 Installing Order Tracker Backend Dependencies..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# Database Setup
echo ""
echo "🗄️  Setting up database..."

# Create database if it doesn't exist (requires MySQL root access)
read -p "Do you want to create the database? (requires MySQL root credentials) [y/N]: " create_db
if [ "$create_db" = "y" ] || [ "$create_db" = "Y" ]; then
    read -p "MySQL root password: " root_pass
    mysql -u root -p"$root_pass" -e "CREATE DATABASE IF NOT EXISTS order_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    mysql -u root -p"$root_pass" -e "CREATE USER IF NOT EXISTS 'order_user'@'localhost' IDENTIFIED BY 'order_pass_123!';"
    mysql -u root -p"$root_pass" -e "GRANT ALL PRIVILEGES ON order_tracker.* TO 'order_user'@'localhost';"
    mysql -u root -p"$root_pass" -e "FLUSH PRIVILEGES;"
    echo "✓ Database and user created"
fi

# Initialize database tables
echo ""
echo "Initializing database tables..."
python init_db.py

# Generate admin password hash
echo ""
echo "Generating admin password hash..."
HASH=$(python3 -c "from bcrypt import hashpw, gensalt; print(hashpw(b'admin123', gensalt()).decode('utf-8'))")
echo "Your ADMIN_PASSWORD_HASH: $HASH"
echo ""
echo "Add this to your .env file:"
echo "ADMIN_PASSWORD_HASH=$HASH"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    cp .env.template .env
    echo "Created .env file from template"
    echo "Please edit .env and add the ADMIN_PASSWORD_HASH value"
fi

echo ""
echo "✅ Backend setup complete!"
echo ""
echo "To run the backend:"
echo "  source venv/bin/activate"
echo "  python app.py"
echo ""
echo "Or use the systemd service:"
echo "  sudo cp crm-dashboard.service /etc/systemd/system/order-tracker.service"
echo "  sudo systemctl enable --now order-tracker"
