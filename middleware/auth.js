const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.admin) {
    return next();
  }
  res.redirect('/admin/login');
};

const isNotAuthenticated = (req, res, next) => {
  if (req.session && req.session.admin) {
    return res.redirect('/admin/dashboard');
  }
  next();
};

module.exports = {
  isAuthenticated,
  isNotAuthenticated
};