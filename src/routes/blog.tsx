import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Calendar, ArrowRight } from "lucide-react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CookieBanner } from "@/components/marketing/CookieBanner";
import { comingSoon } from "@/lib/marketing";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Blog — Nexxos HQ" },
      {
        name: "description",
        content:
          "Insights on team operations, productivity, and building high-performing African teams.",
      },
    ],
  }),
  component: BlogPage,
});

interface Post {
  title: string;
  excerpt: string;
  category: string;
  date: string;
  readTime: string;
}

const FEATURED: Post = {
  title: "Why African Teams Need Their Own Operations Stack",
  excerpt:
    "Off-the-shelf Western tools rarely account for the realities of running a team across Lagos, Nairobi, and Accra — from connectivity gaps to local payroll rules. Here's why we built Nexxos HQ from the ground up for African operations.",
  category: "Product",
  date: "June 2, 2026",
  readTime: "6 min read",
};

const POSTS: Post[] = [
  {
    title: "5 Signs Your Team Is Heading Toward Burnout (and How to Catch It Early)",
    excerpt:
      "Burnout rarely shows up overnight. We break down the early warning signs in attendance, task velocity, and check-in sentiment — and how AI insights can flag them before they become a resignation.",
    category: "People & Culture",
    date: "May 26, 2026",
    readTime: "5 min read",
  },
  {
    title: "OKRs vs KPIs: Which One Should Your Team Actually Use?",
    excerpt:
      "Objectives and Key Results get a lot of hype, but for many small teams a simple KPI dashboard does the job. We compare both approaches and help you decide what fits your stage.",
    category: "Performance",
    date: "May 19, 2026",
    readTime: "7 min read",
  },
  {
    title: "Running Daily Standups Async: A Practical Guide",
    excerpt:
      "Live standups eat into focus time, especially for distributed teams across time zones. Here's how to run effective async standups that keep everyone aligned without another meeting.",
    category: "Remote Work",
    date: "May 12, 2026",
    readTime: "4 min read",
  },
  {
    title: "GPS Clock-In: Balancing Accountability and Trust",
    excerpt:
      "Location-based attendance can feel invasive if rolled out badly. We share how operations teams use GPS clock-in responsibly — and the policies that keep it fair for everyone.",
    category: "Attendance",
    date: "May 5, 2026",
    readTime: "5 min read",
  },
  {
    title: "From Spreadsheets to Systems: A Startup's Journey to Operational Maturity",
    excerpt:
      "A look at how a 12-person creative agency replaced six different spreadsheets and a WhatsApp group with a single source of truth for tasks, attendance, and payroll.",
    category: "Case Study",
    date: "April 28, 2026",
    readTime: "8 min read",
  },
  {
    title: "The Real Cost of Late Tasks (and How to Reduce Them)",
    excerpt:
      "Late deliverables don't just delay one project — they cascade. We dig into the data on how task delays compound across teams, and practical fixes that don't involve micromanagement.",
    category: "Productivity",
    date: "April 21, 2026",
    readTime: "5 min read",
  },
];

function PostCard({ post }: { post: Post }) {
  return (
    <a
      href={comingSoon("blog-post")}
      className="group flex flex-col rounded-xl border border-[#1E1E1E] bg-[#111111] p-6 transition-colors hover:border-white/20"
    >
      <span className="mb-3 inline-flex w-fit rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-400">
        {post.category}
      </span>
      <h3 className="text-lg font-bold text-white leading-snug group-hover:text-blue-400 transition-colors">
        {post.title}
      </h3>
      <p className="mt-2 flex-1 text-[14px] text-gray-400 leading-relaxed">{post.excerpt}</p>
      <div className="mt-4 flex items-center gap-2 text-[12px] text-gray-500">
        <Calendar className="h-3.5 w-3.5" />
        <span>{post.date}</span>
        <span>·</span>
        <span>{post.readTime}</span>
      </div>
    </a>
  );
}

function BlogPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <MarketingNav />

      <div className="mx-auto max-w-6xl px-6 py-16">
        {/* Header */}
        <div className="mb-12 max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight">Blog</h1>
          <p className="mt-4 text-[15px] text-gray-300 leading-relaxed">
            Practical insights on running operations, managing teams, and building a culture of
            accountability — written for founders, managers, and operators across Africa.
          </p>
        </div>

        {/* Featured post */}
        <a
          href={comingSoon("blog-post")}
          className="group mb-12 flex flex-col gap-6 rounded-xl border border-[#1E1E1E] bg-[#111111] p-8 transition-colors hover:border-white/20 md:flex-row md:items-center"
        >
          <div className="flex-1">
            <span className="mb-3 inline-flex w-fit rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-400">
              {FEATURED.category}
            </span>
            <h2 className="text-2xl font-bold text-white leading-snug group-hover:text-blue-400 transition-colors">
              {FEATURED.title}
            </h2>
            <p className="mt-3 text-[15px] text-gray-300 leading-relaxed">{FEATURED.excerpt}</p>
            <div className="mt-4 flex items-center gap-2 text-[12px] text-gray-500">
              <Calendar className="h-3.5 w-3.5" />
              <span>{FEATURED.date}</span>
              <span>·</span>
              <span>{FEATURED.readTime}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-[13px] font-medium text-blue-400">
            Read article
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </a>

        {/* Post grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {POSTS.map((post) => (
            <PostCard key={post.title} post={post} />
          ))}
        </div>
      </div>

      <MarketingFooter />
      <CookieBanner />
    </div>
  );
}
