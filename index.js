const express = require("express")
const cors = require("cors")
const sqlite3 = require("sqlite3").verbose()
const bodyParser = require('body-parser')
const yup = require('yup')
const { parse, isValid, isDate, isFuture, format } = require('date-fns');
const app = express()
app.use(cors());
const port = 3000
app.use(express.json())
app.use(bodyParser.json({ limit: '10mb' })); // Aumentar limite para imagens grandes
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

const db = new sqlite3.Database("./database.db", (err) => {
    if (err) console.error("Erro ao conectar o banco", err.message)
})

db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT , 
        nome TEXT NOT NULL,
        sobrenome TEXT NOT NULL,
        data_nascimento DATE NOT NULL,
        genero TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        imagem TEXT 
    ) `)

const dateFormat = 'dd/MM/yyyy';

// Função utilitária de validação de data para o backend
const validateDate = (value) => {
  if (!value) return false;
  const parsed = parse(value, dateFormat, new Date());
  return isValid(parsed) && isDate(parsed);
};

const userSchemaBackend = yup.object().shape({
  nome: yup.string(),
  sobrenome: yup.string(),
  email: yup.string(),
  data_nascimento: yup.string()
    .required('Data de nascimento é obrigatória')
    .test('is-valid-date', 'Data não existe', validateDate)
    .test('is-past-date', 'Data de nascimento não pode ser no futuro ', function(value) {
      const parsedDate = parse(value, dateFormat, new Date());
      // Permite data de hoje ou anterior
      return !isFuture(parsedDate);
    }),
  genero: yup.string(),
  senha: yup.string(),
  imagem: yup.string(),
});

app.get("/", (req, res) => {
    res.send("healthy")
})

app.post('/usuario', async (req, res) => {
   
  try {
     
    const data = await userSchemaBackend.validate(req.body, { abortEarly: false });
  
    db.get('SELECT email FROM usuarios WHERE email = ?', [data.email], (err, row) => {
      if (err) {
        return res.status(500).json({ error: { message: 'Erro no servidor' } });
      }
      if (row) {
        return res.status(400).json({
          error: {
            field: 'email',
            message: 'Este email já está cadastrado',
          },
        });
      }
      const {  nome, sobrenome, data_nascimento, genero, email, senha, imagem  } = data;
      db.run(
        'INSERT INTO usuarios VALUES (NULL,?, ?, ?, ?, ?, ?, ?)',
        [nome, sobrenome, data_nascimento, genero, email, senha, imagem], // Salva data como string YYYY-MM-DD
        function (err) {
          if (err) {
            console.log(err)
            return res.status(500).json({ error: { message: 'Erro ao salvar usuário' } });
          }
          res.status(201).json({  nome, sobrenome, data_nascimento, genero, email, senha, id: this.lastID, imagem});
        }
      );
    });
  } catch (err) {
    console.log(err)
    if (err instanceof yup.ValidationError) {
      return res.status(400).json({
        error: {
          field: err.path,
          message: err.message,
        },
      });
    }
    res.status(500).json({ error: { message: 'Erro interno do servidor' } })
  }
});

// app.post('/usuario', (req, res) => {
  
//     const data =  userSchemaBackend.validate(req.body, { abortEarly: false });
//     const { nome, sobrenome, data_nascimento, genero, email, senha, imagem } = req.body
//     const response = db.run(`INSERT INTO usuarios VALUES (NULL,?, ?, ?, ?, ?, ?, ?)`,
//         [nome, sobrenome, data_nascimento, genero, email, senha, imagem],
//         function (err) {
//             if (err) {
//                 console.log(err)
//                 return res.status(400).json({ error: err.message })
//             }
//             // if (err === UNIQUE ) {
//             //     console.error(err, "email ja existe")
//             //     return res.status(400).json({ err: 'E-mail já cadastrado' });
//             // }
//             // if (err) {
//             //     return res.status(500).json({ err: 'Erro interno do servidor' });
//             // }
//             res.status(201).json({
//                 nome, sobrenome, data_nascimento, genero, email, senha, id: this.lastID, imagem
//             })
//         }
//     )
// })

app.get("/usuario", (req, res) => {
    db.all(`SELECT * FROM usuarios `, [], (err, rows) => {
        if (err) {
            return res.status(400).json({ error: err.message })
        }
        res.json(rows)
    })
})

app.delete("/usuario/:id", (req, res) => {
    const { id } = req.params
    db.run(`DELETE FROM usuarios WHERE id = ?`,
        [id],
        (err, rows) => {
            if (err) {
                return res.status(400).json({ error: err.message })
            }
            if (!rows) {
                return res.status(404).json({ error: "Usuário não encontrado" })
            }
            res.json({ message: "Usuário deletado com sucesso" })
        }
    )
})

app.get("/usuario/:id", (req, res) => {
    const { id } = req.params
    db.get(`SELECT * FROM usuarios WHERE id = ? `,
        [id],
        (err, rows) => {
            if (err) {
                return res.status(400).json({ error: err.message })
            }
            if (!rows) {
                return res.status(404).json({ error: "Usuário não encontrado" })
            }
            res.json(rows)
        }
    )
})

app.post("/login", (req, res) => {

    const { email, senha } = req.body
    db.get('SELECT * FROM usuarios WHERE email=? AND senha=?',
        [email, senha],
        (err, rows) => {
            if (err) {
                return res.status(400).json({ error: err.message })
            }
            if (!rows) {
                return res.status(404).json({ error: "Usuário não encontrado" })
            }
            res.json(rows)
        }
    )
})

app.put("/atualizar/:id", (req, res) => {

    // const { u} = req.query
    const { id } = req.params
    const { nome, sobrenome, data_nascimento, genero, email, senha, imagem } = req.body
    db.get(
        "SELECT * FROM usuarios WHERE id=?",
        [id],
        (err, row) => {
            if (err) {
                return res.status(400).json({ error: err.message })
            }
            if (!row) {
                return res.status(404).json({ error: "Usuário não encontrado" })
            }
            db.run(
                "UPDATE usuarios SET nome = ?, sobrenome = ?, data_nascimento = ?, genero = ?, email = ?, senha = ?, imagem= ? WHERE id = ?",
                [nome ?? row?.nome, sobrenome ?? row?.sobrenome, data_nascimento ?? row?.data_nascimento, genero ?? row?.genero, email ?? row?.email, senha ?? row?.senha, imagem ?? row?.imagem, id]

            );
            res.json({ message: "usuario atualizado com sucesso" })
        }
    )
    // // Status: OK
    // return res.json(Usuario de id=${id} atualizado com sucesso!)

})

app.listen(port, () => {
    console.log(`servidor rodando em http://localhost:${port}`)
})
