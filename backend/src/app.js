import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173'
}));
app.use(express.json());

// Schema validasi pakai Joi
const itemSchema = Joi.object({
    name: Joi.string().min(2).required(),
    price: Joi.number().min(0).required()
});

let items = [
    { id: 1, name: 'Fotokopi A4', price: 250 }
];

// Endpoint pengecekan server
app.get('/api/v1/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'API EsbeCashRecap berjalan!' });
});

// Ambil data
app.get('/api/v1/items', (req, res) => {
    res.status(200).json({ data: items });
});

// Tambah data
app.post('/api/v1/items', (req, res) => {
    const { error, value } = itemSchema.validate(req.body);
    if (error) {
        return res.status(400).json({
            message: 'Validasi gagal',
            details: error.details.map((d) => d.message)
        });
    }

    const newItem = { id: Date.now(), ...value };
    items.push(newItem);
    res.status(201).json({ message: 'Data berhasil ditambahkan', data: newItem });
});

app.listen(PORT, () => {
    console.log(`Server Express jalan di http://localhost:${PORT}`);
});