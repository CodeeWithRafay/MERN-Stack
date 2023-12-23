const mongoose = require('mongoose');

const {Schema} = mongoose;

const commentSchema = new Schema({
    blog:{type:mongoose.SchemaTypes.ObjectId,ref:"Blog"},
    author:{type:mongoose.SchemaTypes.ObjectId,ref:'User'},
    content:{type:String,required:true},    
}, {timestamps:true});

module.exports = mongoose.model('Comment',commentSchema,"comments");