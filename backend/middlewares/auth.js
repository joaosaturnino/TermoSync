const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const SECRET_KEY = process.env.JWT_SECRET || 'chave_super_secreta_termosync_node';

const verificarToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ error: 'Acesso negado.' });
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  
  jwt.verify(token, SECRET_KEY, async (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token inválido ou expirado.' });
    
    try {
      const [sessoes] = await pool.execute('SELECT revogado FROM sessoes_ativas WHERE token = ?', [token]);
      if (sessoes.length > 0 && sessoes[0].revogado) {
        return res.status(401).json({ error: 'SESSÃO REVOGADA PELO ADMINISTRADOR.' });
      }
    } catch(e) {}

    req.userId = decoded.id; 
    req.userRole = decoded.role; 
    req.userFilial = decoded.filial; 
    req.userEmpresa = decoded.empresa || 'Cliente Alpha (Padrão)'; 
    next();
  });
};

module.exports = {
  SECRET_KEY,
  verificarToken
};