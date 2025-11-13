# Facebook Messenger Relationship Analyzer

A powerful web application that analyzes Facebook Messenger conversations using AI-powered psychoanalysis to understand relationship dynamics, emotional patterns, and how relationships evolve over time.

## Features

- 📊 **Timeline Visualization** - Interactive charts showing message frequency over time
- 🧠 **AI-Powered Analysis** - Deep psychoanalytic insights using Claude AI
- 💬 **Conversation Explorer** - Browse through your message history by month
- 📈 **Relationship Phases** - Understand how your relationship has evolved
- 🎯 **Communication Patterns** - Analyze initiation dynamics and response patterns
- 💡 **Psychological Insights** - Get personalized recommendations for relationship health

## Tech Stack

- **Frontend**: React, Tailwind CSS, Recharts
- **Backend**: Node.js, Express
- **AI**: Claude 4 (Anthropic API)
- **Deployment**: Railway

## Prerequisites

- Node.js 18+ and npm 9+
- Anthropic API key ([get one here](https://console.anthropic.com/))
- Railway account (paid plan for deployment)
- Facebook Messenger data export (JSON format)

## Local Development

1. **Clone or download the project files**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your_actual_api_key_here
   PORT=3001
   ```

4. **Build the React app**
   ```bash
   npm run build
   ```

5. **Start the server**
   ```bash
   npm start
   ```

6. **Open your browser**
   Navigate to `http://localhost:3001`

## Railway Deployment

### Option 1: Deploy from GitHub (Recommended)

1. **Push your code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin your-github-repo-url
   git push -u origin main
   ```

2. **Deploy on Railway**
   - Go to [Railway](https://railway.app/)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway will auto-detect Node.js and deploy

3. **Add environment variables**
   - In your Railway project dashboard, go to "Variables"
   - Add: `ANTHROPIC_API_KEY` with your actual API key
   - Railway automatically sets `PORT`, but you can specify it if needed

4. **Deploy**
   - Railway will automatically build and deploy
   - Click "Generate Domain" to get a public URL

### Option 2: Deploy with Railway CLI

1. **Install Railway CLI**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Initialize project**
   ```bash
   railway init
   ```

4. **Add environment variable**
   ```bash
   railway variables set ANTHROPIC_API_KEY=your_actual_api_key_here
   ```

5. **Deploy**
   ```bash
   railway up
   ```

6. **Get your URL**
   ```bash
   railway domain
   ```

## How to Export Facebook Messenger Data

1. Go to Facebook Settings → Your Facebook Information
2. Click "Download Your Information"
3. Select:
   - Date Range: Choose the period you want
   - Format: **JSON** (important!)
   - Media Quality: Low (we only need text)
   - Select only "Messages"
4. Click "Create File"
5. Wait for Facebook to prepare your download (can take hours/days)
6. Download and extract the ZIP file
7. Upload the JSON files from the `messages/inbox/` folder to the app

## Usage

1. **Upload Files**: Click the upload area and select multiple JSON files from your Messenger export
2. **Select a Person**: Click on any person from your conversation list
3. **View Analysis**: Wait for the AI to analyze the conversation (takes 30-60 seconds)
4. **Explore**: 
   - Read the psychoanalytic assessment
   - View relationship phases and evolution
   - Explore communication patterns
   - Check emotional dynamics
   - Browse actual messages by month

## Project Structure

```
messenger-analyzer/
├── server.js              # Express backend with Claude API proxy
├── package.json           # Dependencies and scripts
├── public/
│   └── index.html        # HTML template
├── src/
│   ├── App.js            # Main React component
│   ├── index.js          # React entry point
│   └── index.css         # Tailwind CSS
├── .env.example          # Environment variables template
├── .gitignore            # Git ignore file
└── README.md             # This file
```

## API Endpoints

- `POST /api/analyze` - Proxies requests to Claude API for conversation analysis
- `GET /api/health` - Health check endpoint
- `GET /*` - Serves the React app

## Environment Variables

- `ANTHROPIC_API_KEY` - Your Anthropic API key (required)
- `PORT` - Port to run the server on (default: 3001, auto-set by Railway)

## Security & Privacy

- All conversation data is processed client-side
- Only text samples are sent to the API for analysis
- Your API key is stored securely as an environment variable
- No data is stored on the server
- The app doesn't store or log your conversations

## Troubleshooting

**Error: "ANTHROPIC_API_KEY not configured"**
- Make sure you've added the API key as an environment variable in Railway

**Build fails on Railway**
- Check that Node version is 18+ in Railway settings
- Ensure all dependencies are in package.json

**Analysis fails**
- Check that your JSON files are valid Messenger exports
- Ensure your API key has sufficient credits
- Check Railway logs for detailed error messages: `railway logs`

**CORS errors**
- The backend proxy should handle this - make sure you're using the Railway URL, not localhost

## Cost Considerations

- **Railway**: Paid plan required (~$5/month minimum)
- **Anthropic API**: Pay-per-use (~$3 per 1M tokens)
- Typical analysis uses ~2000-5000 tokens per conversation
- Estimate: ~$0.01-0.02 per person analyzed

## Contributing

Feel free to submit issues or pull requests!

## License

MIT License - feel free to use this for personal projects

## Support

For issues:
1. Check Railway logs: `railway logs`
2. Check browser console for errors
3. Verify your Messenger export format is correct (JSON, not HTML)

## Acknowledgments

- Built with Claude 4 (Anthropic)
- Deployed on Railway
- Icons by Lucide React
- Charts by Recharts
