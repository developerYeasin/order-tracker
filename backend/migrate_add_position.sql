-- Migration: Add position field for ordering within columns
-- Run this in MySQL to update the existing order_tracker database

-- Add position column to orders table
ALTER TABLE orders ADD COLUMN position INT NULL AFTER courier_parcel_id;

-- Initialize position with order id (lower id = earlier order = should appear first)
-- This maintains the current order after adding the column
UPDATE orders SET position = id;
