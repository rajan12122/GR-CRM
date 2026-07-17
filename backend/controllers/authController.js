const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { readDb, writeDb } = require('../config/db');
const workflow = require('../services/crmWorkflowService');

const JWT_SECRET = process.env.JWT_SECRET || 'GR_CRM_SUPER_SECRET_KEY';

function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required.' });
  }

  const db = readDb();
  const employee = db.employees.find(emp => emp.email.toLowerCase() === email.toLowerCase());

  if (!employee) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  if (employee.status !== 'Active') {
    return res.status(403).json({ message: 'Employee account is inactive.' });
  }

  const hash = employee.passwordHash;
  if (!hash) {
    return res.status(401).json({ message: 'Account is not configured with a login password. Please contact the Admin.' });
  }

  const isValidPassword = bcrypt.compareSync(password, hash);
  if (!isValidPassword) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const tokenVersion = employee.tokenVersion || 1;
  const token = jwt.sign(
    { id: employee.id, name: employee.name, email: employee.email, role: employee.role, tokenVersion },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  const sanitizedUser = {
    id: employee.id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    status: employee.status
  };

  res.json({ token, user: sanitizedUser });
}

function getMe(req, res) {
  const db = readDb();
  const employee = db.employees.find(emp => emp.id === req.user.id);
  if (!employee) return res.status(404).json({ message: 'Profile not found.' });
  res.json(employee);
}

function resetPassword(req, res) {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Access denied: Only Admins can set or reset employee passwords.' });
  }

  const { employeeId, password, confirmPassword } = req.body;
  if (!employeeId || !password || !confirmPassword) {
    return res.status(400).json({ message: 'Employee ID, password, and confirm password fields are required.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match.' });
  }

  const strengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  if (!strengthRegex.test(password)) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character.' });
  }

  const db = readDb();
  const employee = db.employees.find(e => e.id === employeeId);
  if (!employee) {
    return res.status(404).json({ message: 'Employee account not found.' });
  }

  const salt = bcrypt.genSaltSync(12);
  const hash = bcrypt.hashSync(password, salt);
  employee.passwordHash = hash;
  
  employee.tokenVersion = (employee.tokenVersion || 1) + 1;
  delete employee.password;

  const auditLog = {
    id: `LOG-AUD-${Date.now()}`,
    employeeName: req.user.name,
    action: `Reset password for employee: ${employee.name} (${employee.id})`,
    dateTime: new Date().toLocaleString()
  };
  
  if (!db.activity_logs) db.activity_logs = [];
  db.activity_logs.unshift(auditLog);

  // Auditing
  workflow.audit(db, req.user, 'passwordHash', '[PROTECTED]', '[UPDATED HASH]', `Password reset for employee: ${employee.name} (${employee.id}). Active sessions revoked.`, req);

  writeDb(db);
  res.json({ success: true, message: `Password for employee ${employee.name} updated successfully. Active sessions revoked.` });
}

module.exports = {
  login,
  getMe,
  resetPassword
};
