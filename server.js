const express = require('express');
const cors = require('cors');

require('dotenv').config();

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: '*',
  }),
);

app.get('/', (req, res) => {
  res.send('home');
});

app.use('/upload/', require('./routes/Upload'));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on port ${port}`));