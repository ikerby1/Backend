const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    subject: String,
    credits: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Course', CourseSchema);
