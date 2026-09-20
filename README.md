# API Chat Web Client

A modern, highly responsive, privacy-focused local web client for interacting with AI models via API.

## Features

- **100% Local & Private**: All API keys, chat history, and configuration are stored exclusively in your browser's `localStorage`. No backend server, no data uploaded.
- **Universal Provider Support**: Connect to any OpenAI-compatible API endpoint.
- **Localhost APIs**: Seamlessly works with local models hosted via Ollama, LM Studio, and other local servers.
- **Multi-Modal Support**: Drag and drop images directly into the chat for vision-capable models (e.g., GPT-4o, Claude 3.5 Sonnet). The app automatically handles compatibility checks and warnings.
- **Image Generation**: Fully supports image generation models (like DALL-E 3) with dedicated UI formatting and rendering.
- **Modern UI/UX**: Built with React, Tailwind CSS v4, and custom Shadcn UI components. Features a sleek, responsive design with elegant typography, smooth interactions, and a beautiful custom SVG favicon.

## Tech Stack

- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS v4 + Shadcn UI
- **Icons**: Lucide React
- **Fonts**: Outfit (Global UI), Caacupe One (Branding)

## Getting Started

1. Navigate to the project directory:
   ```bash
   cd Custom-Web-Client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open the application in your browser and enter your API configuration in the Settings panel (via the gear icon) to start chatting!

But you don't have to setup on your own!!! that's the main motive, check out the deployed link below and use it right now in your browser!!!
[Go To API Chat Web Client](https://api-chat-web-client-rho.vercel.app/)
