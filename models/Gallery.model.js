import mongoose  from "mongoose";

const mediaItemSchema = new mongoose.Schema({
    url : {type :String , required : true},
    publicId : {type : String , required:true},
    type : {type :String , enum:["image" , "video"],required:true},
    fileName : {type :String},
    size : {type : Number},
});

const gallerySchema = new mongoose.Schema(
  {
    title:  { type: String, required: true, trim: true, maxlength: 80 },
    media:  { type: [mediaItemSchema], default: [] },
  },
  { timestamps: true }
);
 

const Gallery = mongoose.model("Gallery",gallerySchema);
export default Gallery;