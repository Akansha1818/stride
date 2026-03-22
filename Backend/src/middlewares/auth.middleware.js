const jwt = require('jsonwebtoken');
const AuthModel = require('../models/auth.model');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await AuthModel.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        req.user = user;

        if (typeof next === 'function') {
            return next();
        }

        return res.status(200).json({
            message: 'User authenticated',
            user: req.user,
        });
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

module.exports = authMiddleware;
