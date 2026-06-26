# ReadnMake AI

ReadnMake AI is a full-stack web application designed for builders and researchers. It takes a user's project idea, searches the arXiv repository for the most recent relevant academic research papers, and uses Google's Gemini LLM to construct a customized step-by-step reading roadmap.

## Project Structure

```text
readnmake-ai/
├── backend/
│   ├── app.py                # Flask web server, arXiv fetcher, and Gemini caller
│   ├── requirements.txt      # Python dependencies
│   └── .env                  # Environment configuration (Gemini API Key)
├── frontend/
│   ├── index.html            # Core HTML document structure
│   ├── style.css             # Vanilla CSS layout and themes (Times New Roman serif styling)
│   └── script.js             # API request controller & LLM timeline parser
├── .gitignore                # Git paths to ignore
├── Procfile                  # Startup instruction for cloud web servers
└── README.md                 # Main setup manual
```

---

## Local Setup & Development

### 1. Configure the Backend

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Create or update your `.env` configuration file to include your Google Gemini API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. Start the Flask REST API application:
   ```bash
   python app.py
   ```
   The server will start locally at `http://localhost:5000`.

### 2. Configure the Frontend

1. Open `frontend/script.js`.
2. Ensure `BASE_URL` matches your local server endpoint (default is `http://localhost:5000`):
   ```javascript
   const BASE_URL = "http://localhost:5000";
   ```
3. Open `frontend/index.html` directly in a browser of choice, or run a local static server inside the `frontend/` directory (e.g. `npx serve` or using a Live Server extension).

---

## Production Deployment

### Backend Deployment (e.g. Railway or Render)

1. Connect your project's GitHub repository to Railway or Render.
2. The platforms will detect the `Procfile` at the root and initialize the application automatically using the command:
   ```
   web: python backend/app.py
   ```
3. In the environment configuration settings of the platform, add your production environment variables:
   * `GEMINI_API_KEY`: Your Google Gemini API Key.
   * `PORT`: Automatically assigned by the host (the Flask app binds to this dynamically).

### Frontend Deployment (e.g. Netlify or Vercel)

The frontend consists of static assets (HTML, CSS, and JS) and can be deployed for free:
1. Connect the repository to Netlify.
2. Set the **Base Directory** or **Publish Directory** to `frontend/`.
3. In `frontend/script.js`, update the `BASE_URL` variable to point to your live, deployed backend API URL (e.g., `https://your-backend-service.railway.app`).
"# readnmake_ai" 
"# readnmake_ai" 
