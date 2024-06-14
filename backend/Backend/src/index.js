
// //The best one yet
// const express = require('express');
// const dotenv = require('dotenv');
// const connectDB = require('./db/connection.js');
// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');
// const mongoose = require('mongoose');
// const { Schema } = mongoose;
// const pdfParse = require('pdf-parse');
// const compression = require('compression');
// const { HfInference } = require('@huggingface/inference');
// const { uploadOnCloudinary } = require("./utils/cloudinary.js");

// // Initialize express app
// const app = express();
// app.use(compression());
// app.use(express.json());
// dotenv.config({ path: './.env' });

// // DB Connection
// connectDB();

// // Define PdfDetails schema
// const pdfDetailsSchema = new Schema({
//     pdf: String,
//     text: String
// });

// // Create PdfDetails model
// const PdfDetails = mongoose.model('PdfDetails', pdfDetailsSchema);

// // Multer configuration
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, path.join(__dirname, 'public', 'temp'));
//     },
//     filename: (req, file, cb) => {
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//         cb(null, uniqueSuffix + '-' + file.originalname);
//     }
// });
// const upload = multer({ storage: storage });
// const port = process.env.PORT || 3004;

// // Middleware
// app.use(express.json());
// app.use(express.static(path.join(__dirname, 'public')));

// // Initialize Hugging Face Inference API
// const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// // Function to extract URLs from text using regex
// const extractUrls = (text) => {
//     const urlRegex = /(https?:\/\/[^\s]+)/g;
//     return text.match(urlRegex) || [];
// };

// // Routes
// app.get('/api/home', async (req, res) => {
//     const printing = [
//         { id: 1, title: 'Hello1' },
//         { id: 2, title: 'Hello2' }
//     ];
//     res.send(printing);
// });

// // Updated /api/home endpoint to detect URLs
// app.post('/api/home', upload.single('pdfFile'), async (req, res) => {
//     try {
//         if (!req.file) {
//             return res.status(400).json({ message: 'File upload failed' });
//         }

//         const fileName = req.file.filename;
//         const filePath = req.file.path;

//         // Extract text from PDF
//         const dataBuffer = fs.readFileSync(filePath);
//         let extractedText = '';
//         let urls = []; // Array to store detected URLs

//         try {
//             const pdfData = await pdfParse(dataBuffer);
//             extractedText = pdfData.text;

//             // Detect URLs in the extracted text
//             const urlRegex = /(https?:\/\/[^\s]+)/g;
//             urls = extractedText.match(urlRegex) || [];
//         } catch (err) {
//             console.error('Error extracting text from PDF:', err);
//             return res.status(500).json({ message: 'Error extracting text from PDF', error: err.message });
//         }

//         // Save PDF details to database
//         await PdfDetails.create({ pdf: fileName, text: extractedText });

//         // Upload PDF to Cloudinary
//         let cloudinaryResponse;
//         try {
//             cloudinaryResponse = await uploadOnCloudinary(filePath);
//             if (!cloudinaryResponse) {
//                 return res.status(500).json({ message: 'Error uploading PDF to Cloudinary' });
//             }
//         } catch (error) {
//             console.error('Error uploading PDF to Cloudinary:', error);
//             return res.status(500).json({ message: 'Error uploading PDF to Cloudinary', error: error.message });
//         } finally {
//             // Remove the local PDF file after processing
//             fs.unlinkSync(filePath);
//         }





//         return res.status(200).json({ message: 'File uploaded and text extracted successfully', fileName, extractedText, urls });
//     } catch (error) {
//         console.error('Error processing request:', error);
//         return res.status(500).json({ message: 'Internal server error', error: error.message });
//     }
// });

// app.post('/api/query', async (req, res) => {
//     try {
//         const { text, questions } = req.body;

//         if (!text || !questions || !Array.isArray(questions) || questions.length === 0) {
//             return res.status(400).json({ message: 'Text and questions array are required' });
//         }

//         const cleanedText = text.trim();
//         const responses = [];

//         for (let i = 0; i < questions.length; i++) {
//             const cleanedQuestion = questions[i].trim();

//             // Adjust the context size based on your typical input
//             const response = await hf.questionAnswering({
//                 question: cleanedQuestion,
//                 context: cleanedText.substring(0, 5000) // Adjust the context size as needed
//             });

//             responses.push({ question: cleanedQuestion, answer: response.answer });
//         }

//         console.log('Hugging Face Responses:', responses);

//         return res.status(200).json({ responses });
//     } catch (error) {
//         console.error('Error processing request:', error);
//         return res.status(500).json({ message: 'Internal server error', error: error.message });
//     }
// });

// app.listen(port, () => {
//     console.log(`Server running at: http://localhost:${port}/api/home`);
//Faster one
const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./db/connection.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises; // Use promises for async/await
const mongoose = require('mongoose');
const { Schema } = mongoose;
const pdfParse = require('pdf-parse');
const compression = require('compression');
const { HfInference } = require('@huggingface/inference');
const { uploadOnCloudinary } = require("./utils/cloudinary.js");
const NodeCache = require('node-cache'); // For caching

// Initialize express app
const app = express();
app.use(compression());
app.use(express.json());
dotenv.config({ path: './.env' });

// Initialize cache
const cache = new NodeCache({ stdTTL: 600 }); // Cache for 10 minutes

// DB Connection
connectDB();

// Define PdfDetails schema
const pdfDetailsSchema = new Schema({
    pdf: String,
    text: String
});

// Create PdfDetails model
const PdfDetails = mongoose.model('PdfDetails', pdfDetailsSchema);

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public', 'temp'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });
const port = process.env.PORT || 3004;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Hugging Face Inference API
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Function to extract URLs from text using regex
const extractUrls = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
};

// Routes
app.get('/api/home', async (req, res) => {
    const printing = [
        { id: 1, title: 'Hello1' },
        { id: 2, title: 'Hello2' }
    ];
    res.send(printing);
});

// Updated /api/home endpoint to detect URLs
app.post('/api/home', upload.single('pdfFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'File upload failed' });
        }

        const fileName = req.file.filename;
        const filePath = req.file.path;

        // Extract text from PDF
        const dataBuffer = await fs.readFile(filePath);
        let extractedText = '';
        let urls = []; // Array to store detected URLs

        try {
            const pdfData = await pdfParse(dataBuffer);
            extractedText = pdfData.text;

            // Detect URLs in the extracted text
            urls = extractUrls(extractedText);
        } catch (err) {
            console.error('Error extracting text from PDF:', err);
            return res.status(500).json({ message: 'Error extracting text from PDF', error: err.message });
        }

        // Save PDF details to database
        await PdfDetails.create({ pdf: fileName, text: extractedText });

        // Upload PDF to Cloudinary
        let cloudinaryResponse;
        try {
            cloudinaryResponse = await uploadOnCloudinary(filePath);
            if (!cloudinaryResponse) {
                return res.status(500).json({ message: 'Error uploading PDF to Cloudinary' });
            }
        } catch (error) {
            console.error('Error uploading PDF to Cloudinary:', error);
            return res.status(500).json({ message: 'Error uploading PDF to Cloudinary', error: error.message });
        } finally {
            // Remove the local PDF file after processing
            await fs.unlink(filePath);
        }

        return res.status(200).json({ message: 'File uploaded and text extracted successfully', fileName, extractedText, urls });
    } catch (error) {
        console.error('Error processing request:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

app.post('/api/query', async (req, res) => {
    try {
        const { text, questions } = req.body;

        if (!text || !questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ message: 'Text and questions array are required' });
        }

        const cleanedText = text.trim();
        const responses = [];

        // Process questions in parallel using Promise.all
        await Promise.all(questions.map(async (question) => {
            const cleanedQuestion = question.trim();
            const cacheKey = `${cleanedText}:${cleanedQuestion}`;

            // Check cache first
            let cachedAnswer = cache.get(cacheKey);
            if (cachedAnswer) {
                responses.push({ question: cleanedQuestion, answer: cachedAnswer });
                return;
            }

            // Adjust the context size based on your typical input
            const response = await hf.questionAnswering({
                question: cleanedQuestion,
                context: cleanedText.substring(0, 5000) // Adjust the context size as needed
            });

            const answer = response.answer;
            cache.set(cacheKey, answer); // Cache the response
            responses.push({ question: cleanedQuestion, answer });
        }));

        console.log('Hugging Face Responses:', responses);

        return res.status(200).json({ responses });
    } catch (error) {
        console.error('Error processing request:', error);
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at: http://localhost:${port}/api/home`);
});
