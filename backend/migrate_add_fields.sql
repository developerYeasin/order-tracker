-- Migration: Add address, price, and update media file_type
-- Run this in MySQL to update the existing order_tracker database

-- Add new columns to orders table
ALTER TABLE orders ADD COLUMN address TEXT NULL AFTER upazila_zone;
ALTER TABLE orders ADD COLUMN price FLOAT NULL AFTER description;

-- Update media file_type ENUM to include 'File'
-- MySQL: Need to modify the ENUM definition
ALTER TABLE media MODIFY COLUMN file_type ENUM('Image', 'Video', 'File') NOT NULL;
