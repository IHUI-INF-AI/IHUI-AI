"""CLI entrypoints for server management."""

import click


@click.group()
def cli():
    """Server management CLI."""


@cli.command()
@click.option("--host", default="0.0.0.0", help="Bind host")
@click.option("--port", default=8000, help="Bind port")
def run_customer_service(host: str, port: int):
    """Run the customer service bot."""
    import uvicorn

    uvicorn.run("app.main:app", host=host, port=port, reload=False)


@cli.command()
def init_db():
    """Initialize database tables."""
    from scripts.init_db import init_database

    init_database()


@cli.command()
@click.option("--admin-user", required=True, help="Admin username")
@click.option("--admin-pwd", required=True, help="Admin password")
def seed_admin(admin_user: str, admin_pwd: str):
    """Seed an admin user."""
    from scripts.seed_admin import seed_admin as _seed_admin

    _seed_admin(admin_user, admin_pwd)


if __name__ == "__main__":
    cli()
