## Demo

![Image of Vlox](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/27pztn2njbf0zfilxraw.png)

## How I Built Vlox: Breaking the Vanilla JS Wall
I'm an experienced web developer, and my journey into full-stack development started when I wanted to build a private social media platform called *PixUp*. I built it using pure Vanilla JavaScript. Soon, the codebase became heavily bloated, messy, and unmaintainable. 

I tried again with a project called *BlockSocial*. I added complex features like JSONL exports, backup uploads, and post forks. It grew into a giant, complex system that normal users wouldn't understand and as a solo developer, I couldn't maintain it alone. 

I had to stop and ask myself: *Why do my social media apps keep failing?* 
The answer was always the same: **Verbose Vanilla JS.**

### The Problem and The Solution
When planning my next platform, **Vlox**, I evaluated my frontend options:
- **jQuery?** Too old.
- **Modern Frameworks (React/Vue)?** Too heavy.
- **Vanilla JS?** Too verbose.

I then decided to engineer my own solution. I built **NanoScript**—a modern, ultra-lightweight JavaScript library designed for DOM manipulation via a fast, method-chaining API. 

### Bringing Vlox to Life 
With NanoScript handling the frontend, I built **Vlox** as a clean MVP. It features a Node.js/Express backend, MongoDB database storage, secure bcrypt hashing and more. 

Thanks to NanoScript, the frontend architecture is finally in a state that I can easily scale without hitting a wall of messy code.

## Links
- **NanoScript:** [Source Code on Github](https://github.com/Hfs2024/NanoScript)
- **Try Vlox:** [https://vlox.containers.snapdeploy.app/](https://vlox.containers.snapdeploy.app/) or [https://vlox.bonto.run](https://vlox.bonto.run)

If you liked the project, please consider starring it! 