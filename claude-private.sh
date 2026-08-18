#!/bin/bash

# Isolated personal Claude Code profile (separate credentials/settings/history
# from the default ~/.claude dir). Note: the VS Code extension always uses the
# default ~/.claude dir regardless of CLAUDE_CONFIG_DIR, so this script only
# affects CLI/terminal sessions launched from here.
mkdir -p "$HOME/.claude-private"

CLAUDE_CONFIG_DIR="$HOME/.claude-private" claude "$@"