const passport = require('passport');
const crypto = require('crypto')
const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify');

exports.login = passport.authenticate('local', {
  failureRedirect: '/login',
  failureFlash: 'Falied Login!',
  successRedirect: '/',
  successFlash: 'You are now logged in'
});

exports.logout = (req, res) => {
  req.logout();
  req.flash('success', 'You are now logged out!')
  res.redirect('/')
}

exports.isLoggedIn = (req, res, next) => {
  if(req.isAuthenticated()) {
    next();
    return;
  }
  req.flash('error', 'Oops you must be logged in to do that!');
  res.redirect('/login')
}

exports.account = (req, res) => {
  res.render('account', { title: 'Edit Your Account' });
}

exports.forgot = async (req, res) => {
  // 验证用户是否存在
  const user = await User.findOne({ email: req.body.email})
  if (!user) {
    req.flash('error', 'No account with that email exists');
    return res.redirect('/login');
  }
  // 重置 token
  user.resetPasswordToken = crypto.randomBytes(20).toString('hex');
  user.resetPasswordExpires = Date.now() + 3600000;
  await user.save();
  // 发送 email
  const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;
  // req.flash('success', `You have been emailed a password reset link. ${resetURL}`);
  // 跳转到 login page
  res.redirect(resetURL)
}

exports.reset = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  })
  if (!user) {
    req.flash('error', 'Password reset is invalid or has expired');
    return res.redirect('/login')
  }

  res.render('reset', { title: 'Reset your Passport'})
}

exports.confirmedPasswords = (req, res, next) => {
  console.log(req.body.password)
  console.log(req.body['password-confirm'])
  if (req.body.password === req.body['password-confirm']) {
    next();
    return;
  }
  req.flash('error', `Passwords do not match`);
  res.redirect('/login');
}

exports.update = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
    req.flash('error', 'Password reset is invalid or has expired');
    return res.redirect('/login')
  }

  const setPassword = promisify(user.setPassword, user);
  await setPassword(req.body.password);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  const updateUser = await user.save();
  await req.login(updateUser);
  req.flash('success', 'Your password has been reset!')
  res.redirect('/')
}
