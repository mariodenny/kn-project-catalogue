const isAuthenticated = (req, res, next) => {
  console.log('Auth check - Session:', req.sessionID, req.session);
  
  if (req.session && req.session.admin) {
    console.log('User authenticated:', req.session.admin.username);
    return next();
  }
  
  console.log('User not authenticated, redirecting to login');
  res.redirect('/admin/login');
};

const isNotAuthenticated = (req, res, next) => {
  console.log('NotAuth check - Session:', req.sessionID, req.session);
  
  if (req.session && req.session.admin) {
    console.log('User already authenticated, redirecting to dashboard');
    return res.redirect('/admin/dashboard');
  }
  
  next();
};

module.exports = {
  isAuthenticated,
  isNotAuthenticated
};