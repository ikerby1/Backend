const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jwt-simple');
const bcrypt = require('bcryptjs');
const mongoose = require('./Db');

const Course = require('./models/Course');
const User = require('./models/User');

const app = express();
app.use(bodyParser.json());
app.use(express.static('Frontend'));

const JWT_SECRET = process.env.JWT_SECRET || "MY_SECRET_KEY";

// -------------------------
// Authentication Middleware
// -------------------------
function requireAuth(req, res, next) {
    const token = req.headers['x-auth-token'];
    if (!token) {
        return res.status(401).json({ error: "No token provided" });
    }
    try {
        const decoded = jwt.decode(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: "Invalid token" });
    }
}

function requireTeacher(req, res, next) {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ error: "Action allowed for teachers only" });
    }
    next();
}

function requireStudent(req, res, next) {
    if (req.user.role !== 'student') {
        return res.status(403).json({ error: "Action allowed for students only" });
    }
    next();
}

// -------------------------
// User Registration & Login
// -------------------------

// Registration endpoint – creates a new user with hashed password.
app.post('/api/register', async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role || (role !== 'teacher' && role !== 'student')) {
        return res.status(400).json({ error: "Please provide username, password, and a valid role (teacher or student)" });
    }
    
    try {
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);
        
        const newUser = new User({ username, password: hashedPassword, role });
        await newUser.save();
        res.json({ message: "User registered successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Registration failed" });
    }
});

// Login endpoint – authenticates user credentials and returns a JWT token.
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Please provide username and password" });
    }
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid password" });
        }
        const payload = {
            _id: user._id,
            username: user.username,
            role: user.role
        };
        const token = jwt.encode(payload, JWT_SECRET);
        res.json({ token, user: payload });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Login failed" });
    }
});

// -------------------------
// Course Endpoints
// -------------------------

// GET /api/courses – returns a list of courses, with an optional search query (by course name or number)
app.get('/api/courses', async (req, res) => {
    const { search } = req.query;
    let query = {};
    if (search) {
        query = { name: { $regex: search, $options: 'i' } };
    }
    try {
        const courses = await Course.find(query);
        res.json(courses);
    } catch (err) {
        res.status(500).json({ error: "Error fetching courses" });
    }
});

// GET /api/courses/:id – returns details for an individual course.
app.get('/api/courses/:id', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ error: "Course not found" });
        res.json(course);
    } catch (err) {
        res.status(500).json({ error: "Error fetching course details" });
    }
});

// POST /api/courses – creates a new course; only teachers may create courses.
app.post('/api/courses', requireAuth, requireTeacher, async (req, res) => {
    const { name, description, subject, credits } = req.body;
    if (!name || !credits) {
        return res.status(400).json({ error: "Course name and credits are required" });
    }
    try {
        const newCourse = new Course({ name, description, subject, credits });
        await newCourse.save();
        res.json(newCourse);
    } catch (err) {
        res.status(500).json({ error: "Error creating course" });
    }
});

// PUT /api/courses/:id – updates an existing course; teacher only.
app.put('/api/courses/:id', requireAuth, requireTeacher, async (req, res) => {
    const { name, description, subject, credits } = req.body;
    try {
        const updatedCourse = await Course.findByIdAndUpdate(
          req.params.id, 
          { name, description, subject, credits }, 
          { new: true }
        );
        if (!updatedCourse) return res.status(404).json({ error: "Course not found" });
        res.json(updatedCourse);
    } catch (err) {
        res.status(500).json({ error: "Error updating course" });
    }
});

// DELETE /api/courses/:id – deletes a course; teacher only.
app.delete('/api/courses/:id', requireAuth, requireTeacher, async (req, res) => {
    try {
        const deletedCourse = await Course.findByIdAndDelete(req.params.id);
        if (!deletedCourse) return res.status(404).json({ error: "Course not found" });
        res.json({ message: "Course deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: "Error deleting course" });
    }
});

// -------------------------
// Student Endpoints
// -------------------------

// POST /api/students/courses/:id – allows a student to enroll in a course.
app.post('/api/students/courses/:id', requireAuth, requireStudent, async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ error: "Course not found" });

        const student = await User.findById(req.user._id);
        if (student.enrolledCourses.includes(course._id)) {
            return res.status(400).json({ error: "Already enrolled in this course" });
        }
        student.enrolledCourses.push(course._id);
        await student.save();
        res.json({ message: "Course added to schedule", enrolledCourses: student.enrolledCourses });
    } catch (err) {
        res.status(500).json({ error: "Error adding course" });
    }
});

// DELETE /api/students/courses/:id – allows a student to remove a course from their schedule.
app.delete('/api/students/courses/:id', requireAuth, requireStudent, async (req, res) => {
    try {
        const student = await User.findById(req.user._id);
        student.enrolledCourses = student.enrolledCourses.filter(courseId => String(courseId) !== req.params.id);
        await student.save();
        res.json({ message: "Course removed from schedule", enrolledCourses: student.enrolledCourses });
    } catch (err) {
        res.status(500).json({ error: "Error removing course" });
    }
});

// GET /api/students/courses – retrieves all courses the student is enrolled in.
app.get('/api/students/courses', requireAuth, requireStudent, async (req, res) => {
    try {
        const student = await User.findById(req.user._id).populate('enrolledCourses');
        res.json(student.enrolledCourses);
    } catch (err) {
        res.status(500).json({ error: "Error fetching enrolled courses" });
    }
});

// -------------------------
// Start the Server
// -------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
