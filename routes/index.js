const express = require('express');

const router = express.Router();

/* GET home page. */
router.get('/', (req, res) => {
  res.render('index', { title: 'GliP', user: req.user });
});

router.get('/login', (req, res) => {
  res.render('login', { user: req.user });
});

module.exports = router;
