const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const User = mongoose.model('User');
const multer = require('multer');
const Jimp = require('jimp'); // resize photo
const uuid = require('uuid');  // unique id

const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith('image/');
    if (isPhoto) {
      next(null, true);
    } else {
      next({message: 'That fileType isn\'t allowed'}, false);
    }
  }
};

exports.homePage = (req, res) => {
  res.render('hello');
};

exports.addStore = (req, res) => {
  res.render('editStore', {
    title: 'add store'
  });
};

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
  if (!req.file) {
    next();
    return;
  }
  // set photo name
  const extension = req.file.mimetype.split('/')[1];
  const uniqueName = await uuid.v4();
  req.body.photo = `${uniqueName}.${extension}`;
  // resize photo, save
  const photo = await Jimp.read(req.file.buffer);
  await photo.resize(800, Jimp.AUTO);
  await photo.write(`./public/uploads/${uniqueName}.${extension}`);
  next();
};

exports.createStore = async (req, res) => {
  req.body.author = req.user._id;
  const store = await (new Store(req.body)).save();
  // console.log(req.body)
  req.flash('success', `Successfully Created ${store.name}`);
  res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
  const page = req.params.page || 1
  const limit = 4
  const skip = (page * limit) - limit

  const storesPromise = await Store
    .find()
    .skip(skip)
    .limit(limit)
    .sort({ created: 'desc'})
  const countPromise = Store.count()
  const [stores, count] = await Promise.all([storesPromise, countPromise])
  const pages = Math.ceil(count / limit)

  if (!stores.length && skip) {
    req.flash('info', `Hey! you asked for page ${page}.....`)
    res.redirect(`/stores/page/${pages}`)
    return;
  }

  res.render('stores', {title: 'Stores', stores, pages, page, count });
};

const confirmOwner = (store, user) => {
  if (!store.author.equals(user._id)) {
    throw Error('You must own a store in order to edit it');
  }
};

exports.editStore = async (req, res) => {
  const store = await Store.findOne({_id: req.params.id});

  confirmOwner(store, req.user);

  res.render('editStore', {title: `Edit ${store.name}`, store});
};

exports.updateStore = async (req, res) => {
  const store = await Store.findOneAndUpdate({_id: req.params.id}, req.body, {
    new: true, // 返回更新后的新数据
    runValidators: true
  }).exec();
  req.flash('success', `Successfully updated ${store.name}. <a href="/stores/${store.slug}">View Store -> </a>`);
  res.redirect(`/stores/${store._id}/edit`);
};

exports.getStoreBySlug = async (req, res, next) => {
  const store = await Store.findOne({
    slug: req.params.slug
  }).populate('author reviews');

  if (!store) {
    next();
    return;
  }

  res.render('store', {store, title: store.name});
};

exports.getStoreByTag = async (req, res) => {
  const tag = req.params.tag;
  const tagQuery = tag || {$exists: true};

  const tagsPromise = Store.getTagsList();
  const storesPromise = Store.find({tags: tagQuery});
  const [tags, stores] = await Promise.all([
    tagsPromise,
    storesPromise
  ]);

  res.render('tag', {tags, title: 'Tags', tag, stores});
};

exports.searchStores = async (req, res) => {
  const stores = await Store.find({
    $text: {
      $search: req.query.q
    }
  }, {
    score: {$meta: 'textScore'}
  })
    .sort({
      score: {$meta: 'textScore'}
    })
    .limit(5)
  res.json(stores);
};

exports.heartStore = async (req, res) => {
  const hearts = req.user.hearts.map(obj => obj.toString())
  const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet'
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      [operator]: { hearts: req.params.id}},
      {new : true}
    )
  res.json(user)
}

exports.getHearts = async (req, res) => {
  const stores = await Store.find({
    _id: { $in: req.user.hearts }
  })
  res.render('stores', { title: 'Hearted Stores', stores })
}

exports.getTopStores = async (req, res) => {
  const stores = await Store.getTopStores()
  res.render('topStores', { stores, title: '✨ Top Stores'})
}