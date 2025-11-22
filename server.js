import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { openDb, createTable } from './database.js';

const app = express();
app.use(express.json());
app.use(cors()); // Habilita o CORS para o frontend

createTable();

// Configuração do Multer para upload de imagem
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

app.post('/usuario', upload.single('imagem'), async (req, res) => {
  const {  nome, sobrenome, data_nascimento, genero, email, senha } = req.body;
  const imagem = req.file?.path; // Caminho relativo da imagem salva
console.log(imagem)
  const db = await openDb();
  try {
    const result = await db.run(
      'INSERT INTO usuarios VALUES (NULL,?, ?, ?, ?, ?, ?, ?)',
      [nome, sobrenome, data_nascimento, genero, email, senha, imagem]
    );


    res.status(201).json({ id: result.lastID,  nome, sobrenome, data_nascimento, genero, email, senha, imagem});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao cadastrar usuário' });
  }
});

app.get('/usuario', async (req, res) => {

  const db = await openDb();
  try {
    const result = await db.all(`SELECT * FROM usuarios `, [], (error, rows) )


    res.status(201).json({ rows});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'não encontrado usuario' });
  }
});



app.listen(3000, () => {
  console.log('Backend rodando na porta 3000');
});

