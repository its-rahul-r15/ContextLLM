import { cloudinary } from "../config/vectorDb.js";

export const uploadToCloudinary = async (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
};

export const deleteFromCloudinary = async (publicId, resourceType = "raw") => {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

export const getSignedUrl = (publicId, resourceType = "raw", expiresIn = 300) => {
  return cloudinary.utils.private_download_url(publicId, "", {
    resource_type: resourceType,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  });
};
