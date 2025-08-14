# AI Quiz - Causal Funnel

A modern, interactive quiz application built with vanilla JavaScript that provides an engaging learning experience with AI-powered assistance features.

## 🎯 Brief Overview

**AI Quiz** is a Single Page Application (SPA) that delivers a comprehensive quiz experience with the following key features:

### Core Components Built:
- **Authentication System**: Email-based login for personalized experience
- **Dynamic Quiz Engine**: Fetches questions from Open Trivia DB API with fallback support
- **Real-time Timer**: 30-minute countdown with automatic submission
- **AI Assistance System**: 4 types of intelligent clues (50/50, First Letter, Smart Guess, Keywords)
- **Progress Tracking**: Visual overview grid showing visited and attempted questions
- **Performance Analytics**: Detailed reports with time tracking per question
- **Theme System**: 3 beautiful themes (Aurora, Ocean, Sunset)
- **Mobile-First Design**: Fully responsive across all devices
- **PDF Export**: Download detailed quiz reports
- **Anti-Cheating**: Tab visibility detection with warning system

### Approach to the Problem:
The application was designed with **simplicity and portability** in mind. Instead of using complex frameworks, I chose vanilla JavaScript to create a lightweight, fast-loading application that can run anywhere without build steps or dependencies.

## 🚀 Setup & Installation Instructions

### Prerequisites:
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (for fetching questions)

### Quick Start:
1. **Clone or download** the repository
2. **Navigate** to the project directory
3. **Open** `index.html` in your browser
4. **Start quizzing!** 🎉

### Development Server (Optional):
```bash
# Using Python
python -m http.server 8000
# Then visit: http://localhost:8000

# Using Node.js
npx http-server
# Then visit: http://localhost:8080
```

### File Structure:
```
Project-Causal/
├── index.html      # Main HTML file
├── app.js          # Application logic
├── styles.css      # Styling and themes
└── README.md       # This file
```

## 🔧 Technical Architecture

### Why Single HTML, Single JS, Single CSS Files?

I deliberately chose a **single-file architecture** for several strategic reasons:

#### 1. **Zero Build Process**
- No webpack, babel, or build tools required
- Instant deployment - just upload files and it works
- No compilation errors or dependency issues

#### 2. **Maximum Portability**
- Works on any web server (Apache, Nginx, GitHub Pages, Netlify)
- No Node.js or server-side requirements
- Can run from local file system or CDN

#### 3. **Performance Benefits**
- Minimal HTTP requests (only 3 files)
- No bundle splitting or lazy loading complexity
- Faster initial page load
- Smaller total payload size

#### 4. **Maintenance Simplicity**
- All code in one place - easy to understand and modify
- No module resolution or import/export complexity
- Direct debugging without source maps

#### 5. **Educational Value**
- Clear, linear code flow
- Easy to learn and understand
- No framework abstractions hiding the core logic

#### 6. **Future-Proof**
- No framework version updates or breaking changes
- Works with any future browser
- No dependency vulnerabilities

## 📋 Assumptions Made

1. **User Experience**:
   - Users have basic internet literacy
   - Email format validation is sufficient for identification
   - 30-minute time limit is appropriate for 15 questions

2. **Technical**:
   - Modern browsers support ES6+ features
   - LocalStorage is available for data persistence
   - Open Trivia DB API will be accessible
   - Users prefer client-side processing for privacy

3. **Design**:
   - Dark theme is preferred for extended reading
   - Mobile-first approach is optimal
   - Smooth animations enhance user experience

## 🛠️ Challenges Faced & Solutions

### 1. **API Reliability & Offline Support**
**Challenge**: Open Trivia DB API might be unavailable or blocked
**Solution**: Implemented comprehensive fallback system with local questions
```javascript
// Fallback questions ensure app always works
const fallback = [
  { q: 'What is the capital of France?', c: 'Paris', i: ['Lyon','Marseille','Nice'] },
  // ... more questions
];
```

### 2. **Real-time Timer Synchronization**
**Challenge**: Timer needed to update multiple UI elements simultaneously
**Solution**: Created centralized timer function that updates all timer displays
```javascript
// Updates both main timer and quick panel timer
const timeText = `${m}:${s}`;
timerEl.textContent = timeText;
const qpTimer = qs('#qp-time');
if(qpTimer) qpTimer.textContent = timeText;
```

### 3. **Mobile Responsiveness**
**Challenge**: Complex layout needed to work on small screens
**Solution**: Implemented responsive grid system with mobile-specific optimizations
```css
@media (max-width:900px){
  .quiz-layout { grid-template-columns: 1fr !important; }
  .question-grid { grid-template-columns: repeat(4, 1fr); }
}
```

### 4. **State Management**
**Challenge**: Managing complex application state without a framework
**Solution**: Created centralized state object with clear data structure
```javascript
const state = {
  email: '',
  questions: [],
  current: 0,
  startedAt: null,
  // ... organized state management
};
```

### 5. **AI Clue System**
**Challenge**: Creating intelligent assistance without external APIs
**Solution**: Built client-side AI using heuristics and pattern matching
```javascript
// Smart keyword matching for clues
const words = text.replace(/[^a-z0-9 ]/g,' ').split(' ').filter(w=>w.length>3);
const score = w.reduce((acc,t)=> acc + (words.includes(t)? 2 : 0.2), 0);
```

### 6. **Animation Performance**
**Challenge**: Smooth animations without impacting performance
**Solution**: Used GPU-accelerated properties and proper timing
```css
/* GPU-friendly animations only */
will-change: transform, opacity;
transform: translateZ(0); /* Force GPU acceleration */
```

### 7. **Data Persistence**
**Challenge**: Storing quiz attempts without a database
**Solution**: Implemented robust localStorage system with error handling
```javascript
function saveAttempt(payload){
  try{
    const key = storageKeyFor(state.email);
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.push(payload);
    localStorage.setItem(key, JSON.stringify(list));
  }catch(e){ console.warn('Saving attempt failed', e); }
}
```

## 🎨 Features & Functionality

### Quiz Features:
- **15 Multiple Choice Questions** from Open Trivia DB
- **30-Minute Timer** with automatic submission
- **Navigation Controls** (Previous/Next buttons + keyboard arrows)
- **Progress Overview** with visual indicators
- **Question Timing** - tracks time spent per question

### AI Assistance System:
- **50/50**: Eliminates two wrong options
- **First Letter**: Reveals first letter of correct answer
- **Smart Guess**: AI-powered choice recommendation
- **Context Keywords**: Highlights important terms from question

### User Experience:
- **Theme Switching** (Aurora, Ocean, Sunset)
- **Mobile Responsive** design
- **Keyboard Navigation** support
- **Anti-Cheating** detection
- **PDF Report** generation
- **Past Test History** with detailed analytics

### Performance Features:
- **Offline Support** with fallback questions
- **GPU-Accelerated** animations
- **Optimized** for mobile devices
- **Fast Loading** with minimal dependencies

## 🚀 Extra Features - Enhanced User Experience

### **AI-Powered Assistance System**
- **4 Types of Intelligent Clues**:
  - **50/50**: Eliminates two incorrect options, leaving only the correct answer and one wrong option
  - **First Letter Hint**: Reveals the first letter of the correct answer
  - **Smart Guess**: AI-powered recommendation based on keyword matching between question and answer choices
  - **Context Keywords**: Highlights important terms from the question to help focus on key concepts
- **Limited Usage**: 3 total clues per test with type locking (each clue type can only be used once)
- **Client-Side AI**: All intelligence runs locally for privacy and speed

### **Advanced Anti-Cheating System**
- **Tab Switching Detection**: Monitors when users switch away from the quiz tab
- **Warning System**: Incremental warnings (0-4) with clear notifications
- **Auto-Submission**: Automatically submits quiz when maximum warnings (4) are reached
- **Real-time Monitoring**: Continuous visibility change detection during active quiz sessions
- **User-Friendly Alerts**: Clear warning messages explaining the consequences

### **Comprehensive Test History & Reports**
- **Past Test Viewing**: Access to all previous quiz attempts
- **Detailed Reports**: Complete breakdown of each question with:
  - User's selected answer
  - Correct answer
  - Time spent per question
  - Individual question results (Correct/Incorrect)
- **Performance Analytics**: Score percentages and attempt statistics
- **PDF Export**: Download detailed reports as PDF files for offline review
- **Email-Based Storage**: All attempts linked to user's email address

### **Dynamic Theme System**
- **3 Beautiful Themes**:
  - **Aurora**: Default purple-blue gradient theme
  - **Ocean**: Deep blue ocean-inspired theme
  - **Sunset**: Warm orange-red sunset theme
- **Real-time Switching**: Instant theme changes without page reload
- **Persistent Selection**: Theme preference maintained across sessions
- **Smooth Transitions**: 0.3s smooth color transitions between themes

### **Enhanced User Interface Features**
- **Retake Option**: Easy restart functionality from report screen
- **Proper Email Validation**: Strict Gmail format checking with real-time validation
- **Responsive Design**: Optimized for all screen sizes (desktop, tablet, mobile)
- **Keyboard Navigation**: Arrow keys for question navigation
- **Progress Indicators**: Visual feedback for visited and attempted questions
- **Quick Panel**: Collapsible overview with real-time statistics

### **Smart Performance Features**
- **Auto-Submission Triggers**:
  - Time expiration (30-minute limit)
  - Maximum warnings reached (4 warnings)
  - Manual submission option
- **Real-time Statistics**: Live updates of visited questions, attempted answers, and remaining time
- **Fallback System**: Offline support with local questions when API is unavailable
- **Error Handling**: Graceful degradation for all edge cases

### **User Experience Enhancements**
- **Intelligent Performance Remarks**: Dynamic feedback based on score:
  - **Excellent** (12+ correct): "Excellent! You nailed it."
  - **Good** (8-11 correct): "Good job! Keep pushing for excellence."
  - **Fair** (5-7 correct): "Fair attempt. A bit more practice will help."
  - **Needs Improvement** (0-4 correct): "Needs improvement. Start with the fundamentals."
- **Session Management**: Clear logout functionality with confirmation
- **Data Persistence**: All progress and history saved locally
- **Accessibility**: Proper focus management and keyboard navigation support

## 🔒 Privacy & Security

- **Client-Side Processing**: All quiz logic runs locally
- **No External Data**: AI clues use local heuristics only
- **Email Privacy**: Email only used for session identification
- **Local Storage**: Data stays on user's device
- **No Tracking**: No analytics or external scripts

## 🚀 Future Enhancements

- **Question Categories** selection
- **Difficulty Levels** (Easy, Medium, Hard)
- **Social Features** (leaderboards, sharing)
- **Advanced Analytics** (performance trends)
- **Custom Questions** creation
- **Offline Mode** with service workers

## 📱 Browser Support

- **Chrome** 60+
- **Firefox** 55+
- **Safari** 12+
- **Edge** 79+
- **Mobile browsers** (iOS Safari, Chrome Mobile)

## 🤝 Contributing

This is a learning project demonstrating vanilla JavaScript capabilities. Feel free to:
- Fork the repository
- Submit issues or suggestions
- Create pull requests for improvements
- Use as a reference for similar projects

## 📄 License

© 2025 Causal Funnel. All rights reserved.
Created by A Dinesh Reddy

---

**Built with ❤️ using Vanilla JavaScript, HTML5, and CSS3**
