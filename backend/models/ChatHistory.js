'use strict';

const mongoose = require('mongoose');

/**
 * Stores the full conversation history for a user's financial advisor chatbot session.
 * One document per user (upserted on every message save).
 *
 * Messages are capped at MAX_MESSAGES to prevent unbounded growth.
 * When the cap is reached, the oldest messages are dropped so recent context
 * is always preserved.
 */

const MAX_MESSAGES = 200;

const MessageSchema = new mongoose.Schema(
    {
        role:      { type: String, enum: ['user', 'model'], required: true },
        content:   { type: String, required: true, maxlength: 8000 },
        timestamp: { type: Date,   default: Date.now },
    },
    { _id: false } // sub-documents don't need their own _id
);

const ChatHistorySchema = new mongoose.Schema(
    {
        userId:   {
            type:     mongoose.Schema.Types.ObjectId,
            ref:      'User',
            required: true,
            unique:   true, // one history document per user
            index:    true,
        },
        messages: {
            type:    [MessageSchema],
            default: [],
        },
    },
    { timestamps: true } // adds createdAt + updatedAt
);

/**
 * Appends a user message and the model's reply, then trims to MAX_MESSAGES.
 * Creates the document if it doesn't exist (upsert semantics via findOneAndUpdate).
 *
 * @param {string} userId
 * @param {string} userContent
 * @param {string} modelContent
 */
ChatHistorySchema.statics.appendExchange = async function (userId, userContent, modelContent) {
    const now = Date.now();
    const newMessages = [
        { role: 'user',  content: userContent,  timestamp: now },
        { role: 'model', content: modelContent, timestamp: now + 1 },
    ];

    const doc = await this.findOneAndUpdate(
        { userId },
        {
            $push: {
                messages: {
                    $each:  newMessages,
                    $slice: -MAX_MESSAGES, // keep only the most recent N messages
                },
            },
        },
        { upsert: true, new: true }
    );
    return doc;
};

/**
 * Retrieves the last `limit` messages for building Gemini history.
 */
ChatHistorySchema.statics.getRecent = async function (userId, limit = 20) {
    const doc = await this.findOne({ userId }).lean();
    if (!doc) return [];
    return doc.messages.slice(-limit);
};

module.exports = mongoose.model('ChatHistory', ChatHistorySchema);
