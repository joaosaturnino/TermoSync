const express = require('express');

// Importação das rotas
const authRoutes = require('./authRoutes');
const systemRoutes = require('./systemRoutes');
const usersRoutes = require('./usersRoutes');
const hardwareRoutes = require('./hardwareRoutes');
const operationsRoutes = require('./operationsRoutes');
const socRoutes = require('./socRoutes');

module.exports = (io) => {
  const router = express.Router();

  // Injetar io no req para acesso dentro das rotas
  router.use((req, res, next) => {
    req.io = io;
    next();
  });

  router.use('/', authRoutes);
  router.use('/system', systemRoutes);
  router.use('/soc', socRoutes);
  router.use('/', usersRoutes);
  router.use('/', hardwareRoutes);
  router.use('/', operationsRoutes);

  return router;
};