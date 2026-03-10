FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /workspace

FROM base AS build

ARG APP_PATH
ENV APP_PATH="${APP_PATH}"

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN test -n "$APP_PATH"
RUN pnpm install --frozen-lockfile
RUN pnpm --dir "$APP_PATH" run build

FROM base AS runtime

ARG APP_PATH
ENV APP_PATH="${APP_PATH}"
ENV NODE_ENV=production

COPY --from=build /workspace /workspace

EXPOSE 3000
CMD ["sh", "-lc", "pnpm --dir \"$APP_PATH\" start"]
