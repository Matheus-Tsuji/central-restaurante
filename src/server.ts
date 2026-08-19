import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

interface Item {
  id: string,
  name: string,
  price: number,
}

const itemsList: Item[] = []

app.post('/items', (req, res) => {
  const { id, name, price } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({ error: "Nome e preço são obrigatórios." })
  }

  const newItem: Item = { id: uuidv4(), name, price }

  itemsList.push(newItem);

  return res.status(201).json({
    message: 'Item adicionado com sucesso!',
    data: newItem
  })
});

app.get('/items/:id', (req, res) => {
  const { id } = req.params;

  const item = itemsList.find(item => item.id === id);

  if (!item) {
    return res.status(404).json({ error: 'Item não encontrado.' })
  }

  return res.status(200).json(item)
})

app.get('/items', (req, res) => {
  return res.status(200).json(itemsList)
})

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
