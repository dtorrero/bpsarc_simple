const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

// GET /api/inventory - Get user's inventory
router.get('/', authenticateToken, (req, res) => {
  const inventory = db.prepare(`
    SELECT blueprint_name, quantity, created_at, updated_at 
    FROM inventory 
    WHERE user_id = ? 
    ORDER BY blueprint_name
  `).all(req.user.id);

  res.json({
    inventory,
    totalItems: inventory.reduce((sum, item) => sum + item.quantity, 0),
    uniqueItems: inventory.length
  });
});

// POST /api/inventory/:blueprintName - Add blueprint to inventory
router.post('/:blueprintName', authenticateToken, (req, res) => {
  const blueprintName = req.params.blueprintName;
  const quantity = req.body.quantity || 1;

  if (quantity < 1) {
    return res.status(400).json({ error: 'Quantity must be at least 1' });
  }

  // Check if blueprint already exists in user's inventory
  const existing = db.prepare(`
    SELECT id, quantity FROM inventory 
    WHERE user_id = ? AND blueprint_name = ?
  `).get(req.user.id, blueprintName);

  if (existing) {
    // Update quantity
    const newQuantity = existing.quantity + quantity;
    db.prepare(`
      UPDATE inventory 
      SET quantity = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newQuantity, existing.id);

    res.json({
      blueprintName,
      quantity: newQuantity,
      action: 'incremented',
      previousQuantity: existing.quantity
    });
  } else {
    // Insert new item
    db.prepare(`
      INSERT INTO inventory (user_id, blueprint_name, quantity) 
      VALUES (?, ?, ?)
    `).run(req.user.id, blueprintName, quantity);

    res.status(201).json({
      blueprintName,
      quantity,
      action: 'added'
    });
  }
});

// DELETE /api/inventory/:blueprintName - Remove blueprint from inventory
router.delete('/:blueprintName', authenticateToken, (req, res) => {
  const blueprintName = req.params.blueprintName;
  const quantity = req.body.quantity || 1;

  if (quantity < 1) {
    return res.status(400).json({ error: 'Quantity must be at least 1' });
  }

  // Get current quantity
  const existing = db.prepare(`
    SELECT id, quantity FROM inventory 
    WHERE user_id = ? AND blueprint_name = ?
  `).get(req.user.id, blueprintName);

  if (!existing) {
    return res.status(404).json({ error: 'Blueprint not found in inventory' });
  }

  const newQuantity = existing.quantity - quantity;

  if (newQuantity <= 0) {
    // Remove item completely
    db.prepare('DELETE FROM inventory WHERE id = ?').run(existing.id);
    
    res.json({
      blueprintName,
      quantity: 0,
      action: 'removed'
    });
  } else {
    // Update quantity
    db.prepare(`
      UPDATE inventory 
      SET quantity = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newQuantity, existing.id);

    res.json({
      blueprintName,
      quantity: newQuantity,
      action: 'decremented',
      previousQuantity: existing.quantity
    });
  }
});

// PUT /api/inventory/:blueprintName - Set specific quantity
router.put('/:blueprintName', authenticateToken, (req, res) => {
  const blueprintName = req.params.blueprintName;
  const quantity = req.body.quantity;

  if (quantity === undefined || quantity < 0) {
    return res.status(400).json({ error: 'Valid quantity required (>= 0)' });
  }

  if (quantity === 0) {
    // Remove item
    db.prepare(`
      DELETE FROM inventory 
      WHERE user_id = ? AND blueprint_name = ?
    `).run(req.user.id, blueprintName);

    res.json({
      blueprintName,
      quantity: 0,
      action: 'removed'
    });
  } else {
    // Upsert item
    const existing = db.prepare(`
      SELECT id FROM inventory 
      WHERE user_id = ? AND blueprint_name = ?
    `).get(req.user.id, blueprintName);

    if (existing) {
      db.prepare(`
        UPDATE inventory 
        SET quantity = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(quantity, existing.id);
    } else {
      db.prepare(`
        INSERT INTO inventory (user_id, blueprint_name, quantity) 
        VALUES (?, ?, ?)
      `).run(req.user.id, blueprintName, quantity);
    }

    res.json({
      blueprintName,
      quantity,
      action: existing ? 'updated' : 'added'
    });
  }
});

module.exports = router;
