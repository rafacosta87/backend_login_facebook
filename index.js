//na linha 13 esta criando o arquivo banco de dados, passamos o nome e endereço
//na linha 16 esta criando a tabela com suas respectivas colunas, se não existir ela cria no banco de dados. 
//pesquisar referente o cors e perguntar sobre para Jadson, as questões que ele estava vendo no terminal da pagina. Perguntar qual é a melhor maneira de salvar o backend no github e qual nome ele daria.
//a questão do if(err) que pega o primeiro erro dos endpoints , qual é mesmo esse erro?
const express = require("express")
const cors = require("cors")
const sqlite3 = require("sqlite3").verbose()

const app = express()
app.use(cors())
const port = 3000
app.use(express.json())

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

app.get("/", (req, res) => {
    res.send("healthy")
})

app.post("/usuario", (req, res) => {
    const { nome, sobrenome, data_nascimento, genero, email, senha, imagem } = req.body
    console.log(data_nascimento)
    const response = db.run(`INSERT INTO usuarios VALUES (NULL,?, ?, ?, ?, ?, ?, ?)`,
        [nome, sobrenome, data_nascimento, genero, email, senha, imagem],
        function (err) {
            if (err) {
                return res.status(400).json({ error: err.message })
            }
            console.log(this)
            res.status(201).json({
                nome, sobrenome, data_nascimento, genero, email, senha, id: this.lastID
            })
        }
    )
})

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

app.listen(port, () => {
    console.log(`servidor rodando em http://localhost:${port}`)
})



