import asyncio
import os
from google.antigravity import Agent, LocalAgentConfig, types

async def main():
    if "GEMINI_API_KEY" not in os.environ:
        print("Error: GEMINI_API_KEY environment variable is missing.")
        print("Please set it before running this script.")
        return

    read_only_tools = [
        types.BuiltinTools.VIEW_FILE,
        types.BuiltinTools.LIST_DIR,
        types.BuiltinTools.SEARCH_DIR,
        types.BuiltinTools.FIND_FILE,
    ]

    security_auditor = types.SubagentConfig(
        name="security_auditor",
        description="Scans the project for vulnerabilities, unescaped inputs, exposed secrets, and security flaws.",
        capabilities=types.SubagentCapabilities(
            agent_behavior=types.AgentBehavior.AUTONOMOUS,
            enabled_tools=read_only_tools,
        ),
    )

    code_quality_auditor = types.SubagentConfig(
        name="code_quality_auditor",
        description="Reviews the project for best practices, complex functions, code structure, and dead code.",
        capabilities=types.SubagentCapabilities(
            agent_behavior=types.AgentBehavior.AUTONOMOUS,
            enabled_tools=read_only_tools,
        ),
    )

    performance_auditor = types.SubagentConfig(
        name="performance_auditor",
        description="Analyzes the project for performance bottlenecks, React rendering loops (e.g. exhaustive-deps), and heavy components.",
        capabilities=types.SubagentCapabilities(
            agent_behavior=types.AgentBehavior.AUTONOMOUS,
            enabled_tools=read_only_tools,
        ),
    )

    config = LocalAgentConfig(
        subagents=[security_auditor, code_quality_auditor, performance_auditor],
        capabilities=types.CapabilitiesConfig(
            enable_subagents=True,
            max_subagent_depth=2,
            allowed_subagents=["security_auditor", "code_quality_auditor", "performance_auditor"],
            enabled_tools=[types.BuiltinTools.EDIT_FILE, types.BuiltinTools.CREATE_FILE]
        ),
        # Using a reliable model for orchestration
        model="models/gemini-2.5-pro"
    )

    print("Starting multi-agent audit orchestrator...")
    async with Agent(config) as agent:
        prompt = (
            "You are the Lead Audit Orchestrator for the 'ShadowTalk' project located in the current directory. "
            "Please spawn your three subagents ('security_auditor', 'code_quality_auditor', 'performance_auditor') "
            "and instruct them to deeply analyze the `src/` directory. "
            "Once they have all reported back, synthesize their findings into a comprehensive markdown report. "
            "Focus specifically on the React codebase (src/pages, src/components, src/lib). "
            "Save the final synthesized report to 'audit_report.md' using the file creation tool. "
            "If you do not have the file creation tool, just output the report in your final message."
        )
        
        response = await agent.chat(prompt)
        print("Audit Complete. Final Response:\n")
        print(await response.text())

if __name__ == "__main__":
    asyncio.run(main())
