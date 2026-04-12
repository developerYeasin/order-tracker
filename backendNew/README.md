# backendNew

Node.js version of the existing Order Tracker backend.

## Setup

1. Copy `.env.template` to `.env` and fill values.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```

## Notes

- Uses MySQL via Sequelize.
- Uploads are saved to `uploads/` or Cloudinary when configured.
- API prefixes mirror the original Python backend under `/api`.
