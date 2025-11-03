"""
Database models and connection for DashBorg
"""
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

# Database setup
DATABASE_PATH = os.getenv("DATABASE_PATH", "/data/dashborg.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False},
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# Database Models

class Repository(Base):
    """Borg repository information"""
    __tablename__ = "repositories"
    
    id = Column(Integer, primary_key=True, index=True)
    label = Column(String, unique=True, index=True)  # borgmatic label (e.g., "hetzner")
    location = Column(String, nullable=False)  # SSH path or local path
    repo_id = Column(String, unique=True)  # Borg repository ID
    encryption_mode = Column(String)
    last_modified = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    archives = relationship("Archive", back_populates="repository", cascade="all, delete-orphan")
    statistics = relationship("RepositoryStatistics", back_populates="repository", cascade="all, delete-orphan")


class Archive(Base):
    """Borg archive (backup snapshot) information"""
    __tablename__ = "archives"
    
    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(Integer, ForeignKey("repositories.id"), nullable=False, index=True)
    
    # Archive identification
    name = Column(String, nullable=False, index=True)
    archive_id = Column(String, unique=True)  # Borg archive ID
    
    # Timestamps
    start = Column(DateTime, index=True)
    end = Column(DateTime)
    duration = Column(Float)  # seconds
    
    # Statistics
    original_size = Column(Integer)  # bytes
    compressed_size = Column(Integer)  # bytes
    deduplicated_size = Column(Integer)  # bytes
    nfiles = Column(Integer)
    
    # Metadata
    hostname = Column(String)
    username = Column(String)
    comment = Column(Text)
    command_line = Column(JSON)  # Store as JSON array
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    repository = relationship("Repository", back_populates="archives")


class BackupJob(Base):
    """Backup job execution history"""
    __tablename__ = "backup_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, unique=True, index=True)  # UUID
    
    # Job info
    job_type = Column(String, index=True)  # "backup-create", "prune", "check", etc.
    config_file = Column(String)
    command = Column(Text)
    
    # Status tracking
    status = Column(String, index=True)  # "pending", "running", "completed", "failed"
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    # Progress tracking
    files_processed = Column(Integer, default=0)
    current_file = Column(Text)
    last_progress_update = Column(DateTime)
    
    # Results
    return_code = Column(Integer)
    output = Column(Text)
    error = Column(Text)
    stats = Column(JSON)  # Store full stats JSON
    
    # Link to archive if created
    archive_id = Column(Integer, ForeignKey("archives.id"), nullable=True)
    archive = relationship("Archive")


class RepositoryStatistics(Base):
    """Aggregated repository statistics over time"""
    __tablename__ = "repository_statistics"
    
    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(Integer, ForeignKey("repositories.id"), nullable=False, index=True)
    
    # Snapshot timestamp
    collected_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Cache statistics
    total_chunks = Column(Integer)
    total_csize = Column(Integer)  # compressed size
    total_size = Column(Integer)  # original size
    unique_chunks = Column(Integer)
    unique_csize = Column(Integer)
    unique_size = Column(Integer)
    
    # Calculated metrics
    deduplication_ratio = Column(Float)  # calculated
    
    repository = relationship("Repository", back_populates="statistics")


# Database initialization
def init_db():
    """Create all tables"""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency for FastAPI endpoints"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
