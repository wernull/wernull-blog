# Jekyll dev/build image for wernull.com
#
# Debian Bookworm ships libvips 8.14 via apt, which jekyll_picture_tag
# (ruby-vips) needs — no compiling from source required.
FROM ruby:3.1-bookworm

# System dependencies:
#   libvips42      - native library for jekyll_picture_tag / ruby-vips
#   build-essential, libffi-dev - to compile native gems (ffi, etc.)
RUN apt-get update -qq \
 && apt-get install -y --no-install-recommends \
      build-essential \
      libffi-dev \
      libvips42 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/jekyll

# Install gems first so this layer is cached unless the Gemfile changes.
# Gems live in the image's default bundle path (/usr/local/bundle); the app
# source is bind-mounted at runtime via docker-compose, so it never shadows them.
COPY Gemfile Gemfile.lock ./
RUN gem install bundler -v "$(tail -1 Gemfile.lock | tr -d ' ')" \
 && bundle install

# 4000  - Jekyll site
# 35729 - LiveReload
EXPOSE 4000 35729

# Polling is required for file-change detection across Docker bind mounts on macOS.
CMD ["bundle", "exec", "jekyll", "serve", \
     "--host", "0.0.0.0", \
     "--livereload", \
     "--force_polling"]
