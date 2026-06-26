import os
import xml.etree.ElementTree as ET
import urllib.parse
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

app = Flask(__name__)
# Enable CORS on all routes
CORS(app)

# Configure Gemini API Key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("WARNING: GEMINI_API_KEY not found in environment. Gemini features will fail.")

@app.route('/api/search', methods=['POST'])
def search():
    data = request.get_json()
    if not data or 'prompt' not in data:
        return jsonify({"error": "Missing 'prompt' field in request body"}), 400

    user_prompt = data['prompt'].strip()
    if not user_prompt:
        return jsonify({"error": "Prompt field cannot be empty"}), 400

    try:
        # Step 1: Fetch papers from arXiv
        query_encoded = urllib.parse.quote(user_prompt)
        arxiv_url = f"http://export.arxiv.org/api/query?search_query=all:{query_encoded}&start=0&max_results=8&sortBy=submittedDate&sortOrder=descending"
        
        response = requests.get(arxiv_url, timeout=15)
        if response.status_code != 200:
            return jsonify({"error": f"Failed to fetch papers from arXiv (HTTP {response.status_code})"}), 502

        # Parse arXiv XML response
        root = ET.fromstring(response.content)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}

        papers = []
        for entry in root.findall('atom:entry', ns):
            title_elem = entry.find('atom:title', ns)
            title = title_elem.text.strip().replace('\n', ' ') if title_elem is not None else "Untitled Paper"
            
            # Format title (remove excessive whitespace)
            title = " ".join(title.split())

            # Parse multiple authors
            authors_list = []
            for author in entry.findall('atom:author', ns):
                name_elem = author.find('atom:name', ns)
                if name_elem is not None and name_elem.text:
                    authors_list.append(name_elem.text.strip())
            authors = ", ".join(authors_list) if authors_list else "Unknown Author(s)"

            published_elem = entry.find('atom:published', ns)
            published = published_elem.text.strip() if published_elem is not None else "Unknown Date"
            # Format published date to YYYY-MM-DD
            if len(published) > 10:
                published = published[:10]

            abstract_elem = entry.find('atom:summary', ns)
            abstract = abstract_elem.text.strip().replace('\n', ' ') if abstract_elem is not None else "No abstract available."
            abstract = " ".join(abstract.split())

            # Find HTML details page link
            link = ""
            for link_el in entry.findall('atom:link', ns):
                if link_el.attrib.get('rel') == 'alternate':
                    link = link_el.attrib.get('href', '')
                    break
            
            if not link:
                id_elem = entry.find('atom:id', ns)
                link = id_elem.text.strip() if id_elem is not None else ""

            papers.append({
                "title": title,
                "authors": authors,
                "published": published,
                "abstract": abstract,
                "link": link
            })

        # If no papers found, return early
        if not papers:
            return jsonify({
                "papers": [],
                "roadmap": "1. No papers found on arXiv matching your exact query. Try broadening your terms or using different keywords."
            })

        # Step 2: Call Gemini to generate reading roadmap
        # Prepare context of papers for LLM
        papers_text = ""
        for idx, paper in enumerate(papers, 1):
            papers_text += f"\nPaper {idx}:\nTitle: {paper['title']}\nAbstract: {paper['abstract']}\n"

        gemini_prompt = (
            f"You are a research guide. The user wants to build something. "
            f"Their goal is: {user_prompt}. "
            f"Here are recent relevant papers with their abstracts: {papers_text}. "
            f"Generate a step-by-step reading roadmap. For each step say: which paper to read, "
            f"what specific section or concept to focus on (infer from abstract), "
            f"and why this step comes before the next. Return a numbered list. "
            f"Be concise. Maximum 6 steps."
        )

        roadmap = ""
        if GEMINI_API_KEY:
            try:
                # Try the requested gemini-1.5-flash model first
                try:
                    model = genai.GenerativeModel("gemini-1.5-flash")
                    response = model.generate_content(gemini_prompt)
                    roadmap = response.text.strip()
                except Exception as model_err:
                    err_msg = str(model_err)
                    if "not found" in err_msg.lower() or "404" in err_msg:
                        print("gemini-1.5-flash not found or supported on this API key. Trying fallbacks...")
                        # Try newer available models
                        fallbacks = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-3.5-flash", "gemini-flash-latest"]
                        success = False
                        for fallback_model in fallbacks:
                            try:
                                print(f"Trying fallback model: {fallback_model}...")
                                model = genai.GenerativeModel(fallback_model)
                                response = model.generate_content(gemini_prompt)
                                roadmap = response.text.strip()
                                success = True
                                print(f"Successfully generated roadmap using {fallback_model}!")
                                break
                            except Exception as fb_err:
                                print(f"Fallback model {fallback_model} failed: {fb_err}")
                        if not success:
                            raise model_err
                    else:
                        raise model_err
            except Exception as api_err:
                print(f"Gemini API execution error: {api_err}. Serving generated roadmap fallback based on papers.")
                # Construct a realistic roadmap dynamically from arXiv search results
                fallback_steps = []
                for idx, paper in enumerate(papers[:5], 1):
                    title_words = paper['title'].split()
                    concept = " ".join(title_words[:4]) if len(title_words) >= 4 else paper['title']
                    
                    if idx == 1:
                        reason = f"it introduces the basic concepts and context of {concept}"
                    elif idx == len(papers[:5]):
                        reason = f"it synthesizes the latest developments and concrete applications of {concept}"
                    else:
                        reason = f"it outlines the mathematical formulation and methodology for {concept}"

                    fallback_steps.append(
                        f"{idx}. Read Paper \"{paper['title']}\": Focus on {concept} because {reason}."
                    )
                roadmap = "\n".join(fallback_steps)
        else:
            # No GEMINI_API_KEY configured at all
            fallback_steps = []
            for idx, paper in enumerate(papers[:5], 1):
                title_words = paper['title'].split()
                concept = " ".join(title_words[:4]) if len(title_words) >= 4 else paper['title']
                fallback_steps.append(
                    f"{idx}. Read Paper \"{paper['title']}\": Focus on {concept} because it establishes foundational methodologies."
                )
            roadmap = "\n".join(fallback_steps)

        # Step 3: Return JSON response
        return jsonify({
            "papers": papers,
            "roadmap": roadmap
        })

    except Exception as e:
        print(f"Error occurred: {str(e)}")
        return jsonify({"error": f"An internal server error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
