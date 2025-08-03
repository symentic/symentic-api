import express from 'express';
import cors from 'cors';
import { profilesRouter } from './routes/profiles';
import { Amplify } from 'aws-amplify';
import amplifyConfig from '../../amplify_outputs.json';

// Configure Amplify
Amplify.configure(amplifyConfig);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/profiles', profilesRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});