const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

// 定义数据格式和类型
const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true, // 去除多余空格
    required: 'please enter  name' // 错误提示：error message
  },
  slug: String,
  description: {
    type: String,
    trim: true,
    required: 'please enter description'
  },
  tags: [String],
  created: {
    type: Date,
    default: new Date().getTime()
  },
  photo: String,
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User', // 数据关联
    required: 'You must supply an author'
  }
}, {
  toJSON: {virtuals: true},
  toObject: {virtuals: true}
});

// 定义 indexes
storeSchema.index({
  name: 'text',
  description: 'text'
});

// 在 schema 储存之前，定义 slug
storeSchema.pre('save', async function (next) {
  if (!this.isModified('name')) {
    next(); // 跳过，不处理
    return;
  }
  this.slug = slug(this.name);

  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
  const storesWithSlug = await this.constructor.find({slug: slugRegEx});

  if (storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
  }

  next();
});

storeSchema.statics.getTagsList = function () {
  return this.aggregate([
    {$unwind: '$tags'},
    {$group: {_id: '$tags', count: {$sum: 1}}},
    {$sort: {count: -1}}
  ]);
};

storeSchema.statics.getTopStores = function () {
  return this.aggregate([
    // lookup stores and populate their reviews
    {
      $lookup: {
        from: 'reviews',
        localField: '_id',
        foreignField: 'store',
        as: 'reviews'
      }
    },
    {
      $match: { 'reviews.1': { $exists: true }}
    },
    {
      $project: {
        photo: '$$ROOT.photo',
        name: '$$ROOT.name',
        reviews: '$$ROOT.reviews',
        slug: '$$ROOT.slug',
        averageRating: { $avg: '$reviews.rating' }
      }
    },
    {
      $sort: { averageRating: -1}
    },
    {
      $limit: 10
    }
  ]);
};

storeSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'store'
});

function autopopulate(next) {
  this.populate('reviews')
  next()
}

storeSchema.pre('find', autopopulate)
storeSchema.pre('findOne', autopopulate)


module.exports = mongoose.model('Store', storeSchema);