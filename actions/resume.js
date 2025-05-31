"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { revalidatePath } from "next/cache";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function saveResume(content) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    const resume = await db.resume.upsert({
      where: {
        userId: user.id,
      },
      update: {
        content,
      },
      create: {
        userId: user.id,
        content,
      },
    });

    revalidatePath("/resume");
    return resume;
  } catch (error) {
    console.error("Error saving resume:", error);
    throw new Error("Failed to save resume");
  }
}

export async function getResume() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  return await db.resume.findUnique({
    where: {
      userId: user.id,
    },
  });
}

export async function improveWithAI({ current, type }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      industryInsight: true,
    },
  });

  if (!user) throw new Error("User not found");

  const prompt = `
You are an expert resume writer with knowledge of LaTeX-based resume structures.

Refer to the following LaTeX template as a guide to understand the formatting, structure, and where each section (education, projects, skills, etc.) belongs:

-----------------------
\\documentclass{article}
\\usepackage{...}
...

\\section*{Education}
\\resumeSubheading
{Jadavpur University}{2026}
{B.E. in Computer Science and Engineering}{GPA: 7.6/10}

\\section*{Projects}
\\resumeSubSubheading
{iNoteBook}{MERN stack}
{Developed a secure, cloud-based notebook app...}

\\section*{Technical Skills}
\\resumeItemListStart
\\resumeItem{Languages: C++, JavaScript, Python}
...

\\section*{Soft Skills}
Teamwork, Communication, Time Management

\\section*{Coding Profiles}
Leetcode, GFG, GitHub
-----------------------

Now, using this layout as a reference, improve the following resume **${type}** content for a **${user.industry}** professional:

"${current}"

Guidelines:
- Use impactful action verbs.
- Add metrics and measurable outcomes.
- Highlight relevant technologies and skills.
- Keep it concise but achievement-oriented.
- Ensure tone and content are appropriate for that section (based on LaTeX structure).

Respond only with improved content, suitable to be inserted back into that section.
Do not return LaTeX.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const improvedContent = response.text().trim();
    return improvedContent;
  } catch (error) {
    console.error("Error improving content:", error);
    throw new Error("Failed to improve content");
  }
}
