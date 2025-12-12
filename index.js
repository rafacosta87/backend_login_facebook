const express = require("express")
const cors = require("cors")
const sqlite3 = require("sqlite3").verbose()
const bodyParser = require('body-parser')
const yup = require('yup')
const { parse, isValid, isDate, isFuture, format, subYears } = require('date-fns')
const app = express()
app.use(cors())
const port = 3000
app.use(express.json())
app.use(bodyParser.json({ limit: '10mb' })) // Aumentar limite para imagens grandes
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }))

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

const dateFormat = 'dd/MM/yyyy'

// Função utilitária de validação de data para o backend
const validateDate = (value) => {
  if (!value) return false
  const parsed = parse(value, dateFormat, new Date())
  return isValid(parsed) && isDate(parsed)
}

const fiveYearsAgo = subYears(new Date(), 5)

const userSchemaBackend = yup.object().shape({
  nome: yup.string().nullable(),
  sobrenome: yup.string().nullable(),
  email: yup.string().nullable().email("Digite um email válido"),
  data_nascimento: yup.string()
    .nullable()
    .matches(
      /^([0-9]?[0-9])\/([0-9]?[0-9])\/\d{4}$/,
      'Formato de data esperado: 00/00/0000'
    )
    .test('is-valid-date', 'Data não existe', function (value) {
      if (!value) return true;
      return validateDate(value);
    })
    .test('is-past-date', 'Data de nascimento não pode ser no futuro', function (value) {
      if (!value) return true;
      const parsedDate = parse(value, dateFormat, new Date());
      return !isFuture(parsedDate);
    })
    .test('is-older-than-5', 'Você deve ter mais de 5 anos', function (value) {
      if (!value) return true;
      const parsedDate = parse(value, dateFormat, new Date());
      // Retorna verdadeiro se a data analisada for anterior (ou igual, dependendo da necessidade) a fiveYearsAgo
      return parsedDate <= fiveYearsAgo;
    }),
  genero: yup.string().nullable().oneOf(['masculino', 'feminino', 'personalizado'], 'Gênero inválido'),
  senha: yup.string().nullable().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  imagem: yup.string().nullable(),
});

app.get("/", (req, res) => {
  res.send("healthy")
})

app.post('/usuario', async (req, res) => {
  try {
    const data = await userSchemaBackend.validate(req.body, { abortEarly: false })
    db.get('SELECT email FROM usuarios WHERE email = ?', [data.email], (err, row) => {
      if (err) {
        return res.status(500).json({ error: { message: 'Erro no servidor' } })
      }
      if (row) {
        return res.status(400).json({
          errors: [{
            type: 'email',
            message: 'Este email já está cadastrado',
          }],
        })
      }
      const { nome, sobrenome, data_nascimento, genero, email, senha, imagem } = data
      db.run(
        'INSERT INTO usuarios VALUES (NULL,?, ?, ?, ?, ?, ?, ?)',
        [nome, sobrenome, data_nascimento, genero, email, senha, imagem],
        function (err) {
          if (err) {
            console.log(err)
            return res.status(500).json({ error: { message: 'Erro ao salvar usuário' } })
          }
          res.status(201).json({ nome, sobrenome, data_nascimento, genero, email, senha, id: this.lastID, imagem })
        }
      )
    })
  } catch (error) {
    console.log(error)
    // Tratamento de erros de validação do Yup
    if (error instanceof yup.ValidationError) {
      // Formata erros para melhor consumo no frontend, se necessário
      return res.status(400).json({ message: 'Erros de validação', errors: error.inner })
    }
    res.status(500).json({ message: 'Erro no servidor' })
  }
});
// catch (err) {
//   // Lidar com erros de validação Yup no backend
//   if (err instanceof yup.ValidationError) {
//     // Retorna o primeiro erro de validação para o frontend processar ou um formato de erro genérico
//     return res.status(400).json({
//       error: {
//         field: err.path,
//         message: err.message,
//       },
//     });
//   }
//   res.status(500).json({ error: { message: 'Erro interno do servidor' } });
// }

app.put("/atualizar/:id", async (req, res) => {
  const { id } = req.params;
  const { nome, sobrenome, data_nascimento, genero, email, senha, imagem } = req.body;
  try {
    // 1. Valida os dados de entrada com o esquema Yup
    await userSchemaBackend.validate(req.body, { abortEarly: false, strict: true });
    // 2. Verifica se o email fornecido já existe no banco de dados, excluindo o usuário atual
    if (email) { // Só verifica se o email está presente no corpo da requisição
      const userWithSameEmail = await new Promise((resolve, reject) => {
        db.get(
          "SELECT id FROM usuarios WHERE email = ? AND id != ?",
          [email, id],
          (err, row) => {
            if (err) reject(err);
            resolve(row);
          }
        );
      });

      if (userWithSameEmail) {
        return res.status(409).json({ // 409 Conflict é um código de status apropriado para duplicação
          // error: "Erro de conflito",
          // details: ["Este email já está cadastrado para outro usuário."]
                errors: [{
            path: 'email',
            message: 'Este email já está cadastrado',
          }],
        });
      }
    }
  } catch (err) {
    console.log(err)
    // Tratamento de erros de validação do Yup
    if (err instanceof yup.ValidationError) {
      // Formata erros para melhor consumo no frontend, se necessário
      return res.status(400).json({ message: 'Erros de validação', errors: err.inner })
    }
    res.status(500).json({ message: 'Erro no servidor' })
  }
  //  (err) {
  //   console.log(err)
  //   // Se a validação do Yup falhar, retorna um erro 400
  //   if (err.name === 'ValidationError') {
  //     return res.status(400).json({
  //       error: "Erro de validação",
  //       details: err.errors
  //     });
  //   }
  //   // Para outros erros (como erro de banco de dados na Promise)
  //   return res.status(500).json({ error: err.message });
  // }
  // // 3. Busca o usuário existente para aplicar a lógica de fallback (se campos não forem fornecidos)
  db.get(
    "SELECT * FROM usuarios WHERE id=?",
    [id],
    (err, row) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      if (!row) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      // 4. Executa a atualização
      db.run(
        "UPDATE usuarios SET nome = ?, sobrenome = ?, data_nascimento = ?, genero = ?, email = ?, senha = ?, imagem= ? WHERE id = ?",
        [
          nome ?? row.nome,
          sobrenome ?? row.sobrenome,
          data_nascimento ?? row.data_nascimento,
          genero ?? row.genero,
          email ?? row.email,
          senha ?? row.senha,
          imagem ?? row.imagem,
          id
        ],
        function (updateErr) {
          if (updateErr) {
            // Em caso de erro no UPDATE (ex: constraint violation não pega antes), loga e retorna
            console.error(updateErr);
            return res.status(400).json({ error: updateErr.message });
          }
          res.json({ message: "Usuário atualizado com sucesso", changes: this.changes });
        }
      );
    }
  );
});



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
  const { email, senha } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email é obrigatório" });
  }
  if (!senha) {
    return res.status(402).json({ error: "Senha é obrigatório" });
  }
  db.get('SELECT * FROM usuarios WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
    if (!user) {
      return res.status(404).json({ error: "Email não existe", field: "email" });
    }
    if (user.senha !== senha) {
      // A senha está incorreta
      return res.status(401).json({ error: "Senha incorreta", field: "senha" });
    }
    res.status(200).json(user);
  });
});

app.listen(port, () => {
  console.log(`servidor rodando em http://localhost:${port}`)
})
