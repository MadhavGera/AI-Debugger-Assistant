"""
PatchGenerator: Converts AI analysis code_fixes into a proper unified git diff
and structured patch preview data for the frontend diff viewer.
"""
import difflib
from typing import List, Dict, Any

import structlog

logger = structlog.get_logger()


class PatchGenerator:
    def generate(
        self,
        analysis: Dict[str, Any],
        code_chunks: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Build a unified diff patch from AI code_fixes.
        Returns both raw patch string and structured hunk data for the UI.
        """
        code_fixes = analysis.get("code_fixes", [])

        if not code_fixes:
            # Fallback: build a comment-only patch explaining the fix
            return self._build_comment_patch(analysis, code_chunks)

        raw_lines = []
        hunks = []

        for fix in code_fixes:
            file_path = fix.get("file_path", "unknown")
            original = fix.get("original_code", "")
            fixed = fix.get("fixed_code", "")

            if not original or not fixed or original.strip() == fixed.strip():
                continue

            original_lines = original.splitlines(keepends=True)
            fixed_lines = fixed.splitlines(keepends=True)

            # Generate unified diff
            diff = list(difflib.unified_diff(
                original_lines,
                fixed_lines,
                fromfile=f"a/{file_path}",
                tofile=f"b/{file_path}",
                lineterm="",
            ))

            if not diff:
                continue

            raw_lines.extend(diff)
            raw_lines.append("")  # blank line between files

            # Build structured hunk for frontend
            hunk = self._parse_diff_to_hunk(diff, file_path)
            if hunk:
                hunks.append(hunk)

        raw_patch = "\n".join(raw_lines)

        # If we couldn't build a diff (identical code), use comment patch
        if not raw_patch.strip():
            return self._build_comment_patch(analysis, code_chunks)

        return {
            "raw_patch": raw_patch,
            "hunks": hunks,
        }

    def _parse_diff_to_hunk(self, diff_lines: List[str], file_path: str) -> Dict[str, Any]:
        """Parse unified diff lines into structured hunk data."""
        hunk = {
            "filePath": file_path,
            "oldStart": 1,
            "newStart": 1,
            "oldLines": 0,
            "newLines": 0,
            "lines": [],
        }

        line_number = 1
        for line in diff_lines:
            if line.startswith("---") or line.startswith("+++"):
                continue
            if line.startswith("@@"):
                # Parse @@ -old_start,old_count +new_start,new_count @@
                import re
                match = re.search(r"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", line)
                if match:
                    hunk["oldStart"] = int(match.group(1))
                    hunk["oldLines"] = int(match.group(2) or 1)
                    hunk["newStart"] = int(match.group(3))
                    hunk["newLines"] = int(match.group(4) or 1)
                    line_number = hunk["oldStart"]
                continue

            if line.startswith("+"):
                hunk["lines"].append({
                    "type": "addition",
                    "content": line[1:],
                    "lineNumber": None,
                })
            elif line.startswith("-"):
                hunk["lines"].append({
                    "type": "deletion",
                    "content": line[1:],
                    "lineNumber": line_number,
                })
                line_number += 1
            else:
                hunk["lines"].append({
                    "type": "context",
                    "content": line[1:] if line.startswith(" ") else line,
                    "lineNumber": line_number,
                })
                line_number += 1

        return hunk if hunk["lines"] else None

    def _build_comment_patch(
        self,
        analysis: Dict[str, Any],
        code_chunks: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Fallback: build a descriptive patch when no concrete code diff is available.
        Shows the most relevant code chunk with a comment explaining the fix.
        """
        if not code_chunks:
            return {"raw_patch": "# No patch generated", "hunks": []}

        top_chunk = code_chunks[0]
        file_path = top_chunk["file_path"]
        original_lines = top_chunk["content"].splitlines(keepends=True)

        fix_comment = f"# AI FIX: {analysis.get('suggested_fix', 'See root cause analysis')}\n"
        fixed_lines = [fix_comment] + original_lines

        diff = list(difflib.unified_diff(
            original_lines,
            fixed_lines,
            fromfile=f"a/{file_path}",
            tofile=f"b/{file_path}",
            lineterm="",
        ))

        raw_patch = "\n".join(diff)
        hunk = self._parse_diff_to_hunk(diff, file_path) or {
            "filePath": file_path,
            "oldStart": top_chunk.get("start_line", 1),
            "newStart": top_chunk.get("start_line", 1),
            "oldLines": len(original_lines),
            "newLines": len(fixed_lines),
            "lines": [
                {"type": "addition", "content": fix_comment, "lineNumber": None},
                *[
                    {"type": "context", "content": l.rstrip("\n"), "lineNumber": i + top_chunk.get("start_line", 1)}
                    for i, l in enumerate(original_lines[:30])
                ],
            ],
        }

        return {"raw_patch": raw_patch, "hunks": [hunk]}
