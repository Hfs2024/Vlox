## Demo

![Image of Vlox](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/xtiaxou9dgc4zwfl73mu.png)

## Link to Code
- **Vlox:** [Source Code on Github](https://github.com/Hfs2024/Vlox)
- **NanoScript:** [Source Code on Github](https://github.com/Hfs2024/NanoScript)

## How I Built It: Breaking the Vanilla JS Wall
I am an experienced web developer, and my journey into full-stack development started when I wanted to build a private social media platform called *PixUp*. I built it using pure Vanilla JavaScript. Soon, the codebase became heavily bloated, messy, and completely unmaintainable. 

In early 2026, I tried again with a project called *BlockSocial*. I added complex features like JSONL exports, backup uploads, and post forks. It grew into a giant, complex system that normal users wouldn't understand, and as a solo developer, I couldn't maintain it alone. 

I had to stop and ask myself: *Why do my social media apps keep failing?* 
The answer was always the same: **Verbose Vanilla JS.**

### The Dilemma & The Solution
When planning my next platform, **Vlox**, I evaluated my frontend options:
- **jQuery?** Too legacy.
- **Modern Frameworks (React/Vue)?** Too heavy for edge environments.
- **Vanilla JS?** Too verbose.

I decided to take the best parts of each and engineer my own solution. I built **NanoScript**—a modern, ultra-lightweight JavaScript library designed for fluent DOM manipulation via a fast, method-chaining API. To make it even more powerful, I engineered custom plugins for it, including a live counter and **Ghost State** (which automatically saves what you type so you never lose a draft).

### Bringing Vlox to Life 
With NanoScript handling the frontend, I built **Vlox** as a clean, high-performance Minimum Viable Product (MVP). It features a robust Node.js/Express backend, MongoDB database storage, secure bcrypt hashing, XSS sanitization, and an optimized Sharp image processing pipeline. 

Thanks to NanoScript, the frontend architecture is finally in a state that I can easily scale without hitting a wall of messy code.

If you liked the project, please drop a star on GitHub!

**Thanks for reading!**
