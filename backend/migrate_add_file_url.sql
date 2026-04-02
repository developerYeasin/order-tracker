-- Add file_url column to media table for Cloudinary URLs
ALTER TABLE media ADD COLUMN file_url VARCHAR(500) NULL AFTER file_path;
