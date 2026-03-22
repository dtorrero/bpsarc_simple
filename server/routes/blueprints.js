const express = require('express');
const fs = require('fs');
const router = express.Router();
const config = require('../config');
const { authenticateToken } = require('../middleware/auth');

// Load blueprints data
let blueprintsData = null;

function loadBlueprints() {
  try {
    const data = fs.readFileSync(config.blueprintsPath, 'utf8');
    blueprintsData = JSON.parse(data);
  } catch (error) {
    console.error('Failed to load blueprints:', error);
    blueprintsData = [];
  }
}

// Load on startup
loadBlueprints();

// GET /api/blueprints - Get all blueprints (with optional filtering)
router.get('/', authenticateToken, (req, res) => {
  if (!blueprintsData) {
    loadBlueprints();
  }

  let filteredBlueprints = [...blueprintsData];

  // Apply filters if provided
  const { search, map, condition, scavengable } = req.query;

  if (search) {
    const searchLower = search.toLowerCase();
    filteredBlueprints = filteredBlueprints.filter(bp =>
      bp.name.toLowerCase().includes(searchLower)
    );
  }

  if (map && map !== 'All') {
    filteredBlueprints = filteredBlueprints.filter(bp => {
      if (bp.map === 'All' || bp.map === 'N/A') return true;
      return bp.map.includes(map);
    });
  }

  if (condition && condition !== 'Any') {
    filteredBlueprints = filteredBlueprints.filter(bp => {
      if (bp.condition === 'Any' || bp.condition === 'N/A') return true;
      return bp.condition.includes(condition);
    });
  }

  if (scavengable && scavengable !== 'Any') {
    filteredBlueprints = filteredBlueprints.filter(bp => {
      if (scavengable === 'Yes') return bp.scavengable === 'Yes';
      if (scavengable === 'No') return bp.scavengable === 'No';
      return true;
    });
  }

  // Add image URL to each blueprint
  const blueprintsWithImages = filteredBlueprints.map(bp => ({
    ...bp,
    imageUrl: `/images/${bp.image_filename}`
  }));

  res.json({
    blueprints: blueprintsWithImages,
    total: blueprintsWithImages.length,
    filters: {
      search: search || null,
      map: map || null,
      condition: condition || null,
      scavengable: scavengable || null
    }
  });
});

// GET /api/blueprints/filters - Get available filter options
router.get('/filters', authenticateToken, (req, res) => {
  if (!blueprintsData) {
    loadBlueprints();
  }

  const maps = new Set();
  const conditions = new Set();
  const scavengableOptions = new Set(['Yes', 'No']);

  blueprintsData.forEach(bp => {
    if (bp.map && bp.map !== 'All' && bp.map !== 'N/A') {
      // Split by newline and add each map
      bp.map.split('\n').forEach(map => {
        if (map.trim()) maps.add(map.trim());
      });
    }

    if (bp.condition && bp.condition !== 'Any' && bp.condition !== 'N/A') {
      // Split by newline and add each condition
      bp.condition.split('\n').forEach(cond => {
        if (cond.trim()) conditions.add(cond.trim());
      });
    }
  });

  res.json({
    maps: Array.from(maps).sort(),
    conditions: Array.from(conditions).sort(),
    scavengableOptions: Array.from(scavengableOptions)
  });
});

// GET /api/blueprints/:name - Get specific blueprint
router.get('/:name', authenticateToken, (req, res) => {
  if (!blueprintsData) {
    loadBlueprints();
  }

  const blueprint = blueprintsData.find(bp => bp.name === req.params.name);

  if (!blueprint) {
    return res.status(404).json({ error: 'Blueprint not found' });
  }

  res.json({
    ...blueprint,
    imageUrl: `/images/${blueprint.image_filename}`
  });
});

module.exports = router;
